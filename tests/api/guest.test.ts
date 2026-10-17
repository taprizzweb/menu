import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDb, type TestDb } from '../../supabase/tests/helpers/db';
import { buildWorld, type World } from '../../supabase/tests/helpers/fixtures';
import { APP, cookieFrom, req, state, uniqueIp } from './helpers';

vi.mock('@/lib/supabase/admin', async () => {
  const h = await import('./helpers');
  return { adminClient: () => h.fakeAdminClient };
});
import { signGuestCookie, GUEST_COOKIE } from '@/lib/security/cookie';
import { POST as orderPOST } from '@/app/api/guest/order/route';
import { GET as statusGET } from '@/app/api/guest/status/route';
import { POST as requestPOST } from '@/app/api/guest/request/route';
import { GET as reviewGET } from '@/app/api/guest/review/route';
import { GET as healthGET } from '@/app/api/health/route';

let db: TestDb;
let w: World;
const SECRET = process.env.GUEST_COOKIE_SECRET!;

beforeAll(async () => {
  db = await createTestDb();
  state.pool = db.pool;
  w = await buildWorld(db);
});
afterAll(async () => db.close());

async function freshTable() {
  const label = `T${randomUUID().slice(0, 6)}`;
  const [r] = await db.admin<{ id: string; qr_token: string }>(`insert into public.dining_tables (restaurant_id, label) values ($1,$2) returning id, qr_token`, [w.A.rid, label]);
  return { id: r!.id, token: r!.qr_token, label };
}
const orderBody = (t: { token: string }, extra: Record<string, unknown> = {}) => ({
  slug: w.A.slug,
  token: t.token,
  idempotency_key: randomUUID(),
  items: [{ item_id: w.A.chai, qty: 2 }],
  ...extra,
});
const json = async (res: Response) => (await res.json()) as Record<string, any>;

describe('POST /api/guest/order', () => {
  it('places an order, returns the DB-computed total and sets a signed HttpOnly session cookie', async () => {
    const t = await freshTable();
    const res = await orderPOST(req('/api/guest/order', orderBody(t, { note: 'less spicy' }), { ip: uniqueIp() }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-request-id')).toBeTruthy();
    const b = await json(res);
    expect(b).toMatchObject({ total_paise: 6000, status: 'placed', replayed: false });
    expect(JSON.stringify(b)).not.toContain(t.token);
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith(`${GUEST_COOKIE}=`))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i); // the site address is https
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Max-Age=43200/);
    expect(setCookie).toMatch(/Path=\//);
  });

  it('refuses price tampering: unknown fields are rejected, and the database total wins anyway', async () => {
    const t = await freshTable();
    for (const bad of [{ total_paise: 1 }, { items: [{ item_id: w.A.paneer, qty: 1, price_paise: 1 }] }]) {
      const res = await orderPOST(req('/api/guest/order', orderBody(t, bad)));
      expect(res.status).toBe(400);
      expect((await json(res)).error.key).toBe('invalid_input');
    }
    const ok = await orderPOST(req('/api/guest/order', orderBody(t, { items: [{ item_id: w.A.paneer, qty: 1 }] })));
    expect((await json(ok)).total_paise).toBe(25000);
  });

  it('rejects a wrong or missing origin (CSRF)', async () => {
    const t = await freshTable();
    for (const o of [{ origin: 'https://evil.example' }, { origin: null }, { origin: null, referer: 'https://evil.example/x' }, { origin: 'http://gotomenu.taprizz.in' }]) {
      const res = await orderPOST(req('/api/guest/order', orderBody(t), o));
      expect(res.status, JSON.stringify(o)).toBe(403);
      expect((await json(res)).error.key).toBe('origin_not_allowed');
    }
    // nothing was created
    const [n] = await db.admin<{ n: number }>(`select count(*)::int n from public.orders where table_id = $1`, [t.id]);
    expect(n!.n).toBe(0);
    // a same-site Referer is accepted when Origin is absent
    const ok = await orderPOST(req('/api/guest/order', orderBody(t), { origin: null, referer: `${APP}/${w.A.slug}` }));
    expect(ok.status).toBe(200);
  });

  it('accepts only application/json', async () => {
    const t = await freshTable();
    for (const ct of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', null]) {
      const res = await orderPOST(req('/api/guest/order', orderBody(t), { contentType: ct }));
      expect(res.status, String(ct)).toBe(415);
    }
  });

  it('rejects oversized and malformed bodies', async () => {
    const t = await freshTable();
    const big = await orderPOST(req('/api/guest/order', undefined, { method: 'POST', rawBody: JSON.stringify(orderBody(t, { note: 'x'.repeat(20000) })) }));
    expect(big.status).toBe(413);
    const bad = await orderPOST(req('/api/guest/order', undefined, { method: 'POST', rawBody: '{not json' }));
    expect(bad.status).toBe(400);
    const empty = await orderPOST(req('/api/guest/order', undefined, { method: 'POST', rawBody: '' }));
    expect(empty.status).toBe(400);
    const arr = await orderPOST(req('/api/guest/order', [1, 2, 3]));
    expect(arr.status).toBe(400);
  });

  it('rejects other HTTP methods', async () => {
    const res = await orderPOST(req('/api/guest/order', undefined, { method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('maps business errors to friendly keys (never database text)', async () => {
    const t = await freshTable();
    const cases: [Record<string, unknown>, number, string][] = [
      [{ token: 'f'.repeat(64) }, 403, 'invalid_table_token'],
      [{ items: [{ item_id: w.A.soldOut, qty: 1 }] }, 409, 'item_unavailable'],
      [{ items: [{ item_id: w.B.paneer, qty: 1 }] }, 409, 'item_not_found'],
      [{ items: [{ item_id: randomUUID(), qty: 1 }] }, 409, 'item_not_found'],
      [{ items: [{ item_id: w.A.chai, qty: 1 }, { item_id: w.A.chai, qty: 1 }] }, 400, 'duplicate_item'],
      [{ items: [{ item_id: w.A.platter, qty: 8 }] }, 422, 'limit_exceeded'],
    ];
    for (const [extra, status, key] of cases) {
      const res = await orderPOST(req('/api/guest/order', orderBody(t, extra)));
      const b = await json(res);
      expect(res.status, key).toBe(status);
      expect(b.error.key).toBe(key);
      expect(JSON.stringify(b)).not.toMatch(/GM0|violates|constraint|select |public\./i);
    }
  });

  it('a token from another restaurant never works on this slug', async () => {
    const tb = (await db.admin<{ qr_token: string }>(`select qr_token from public.dining_tables where restaurant_id = $1 limit 1`, [w.B.rid]))[0]!;
    const res = await orderPOST(req('/api/guest/order', { slug: w.A.slug, token: tb.qr_token, idempotency_key: randomUUID(), items: [{ item_id: w.A.chai, qty: 1 }] }));
    expect(res.status).toBe(403);
  });

  it('replay: the same idempotency key returns the same order, one row only', async () => {
    const t = await freshTable();
    const body = orderBody(t);
    const a = await json(await orderPOST(req('/api/guest/order', body)));
    const b = await json(await orderPOST(req('/api/guest/order', body)));
    expect(b.replayed).toBe(true);
    expect(b.order_no).toBe(a.order_no);
    const [n] = await db.admin<{ n: number }>(`select count(*)::int n from public.orders where table_id = $1`, [t.id]);
    expect(n!.n).toBe(1);
  });

  it('suspended restaurants cannot receive orders', async () => {
    const t = await freshTable();
    await db.admin(`update public.restaurants set status = 'suspended' where id = $1`, [w.A.rid]);
    const res = await orderPOST(req('/api/guest/order', orderBody(t)));
    await db.admin(`update public.restaurants set status = 'active' where id = $1`, [w.A.rid]);
    expect(res.status).toBe(403);
    expect((await json(res)).error.key).toBe('restaurant_suspended');
  });

  it('throttles repeated WRONG-TOKEN attempts from one IP (token guessing): 20 allowed, then 429', async () => {
    const ip = uniqueIp();
    const t = await freshTable();
    let last = 0;
    for (let i = 0; i < 25; i++) {
      const res = await orderPOST(req('/api/guest/order', orderBody({ token: 'a'.repeat(64) }), { ip }));
      last = res.status;
      if (i < 20) expect(res.status, `attempt ${i}`).toBe(403);
    }
    expect(last).toBe(429);
    // the same address is also blocked from the waiter endpoint (one shared guessing budget)...
    expect((await requestPOST(req('/api/guest/request', { slug: w.A.slug, token: t.token, type: 'waiter', reason: 'water' }, { ip }))).status).toBe(429);
    // ...but another address is unaffected
    expect((await orderPOST(req('/api/guest/order', orderBody(t), { ip: uniqueIp() }))).status).toBe(200);
  });

  it('does NOT throttle honest traffic: 45 successful requests from one shared cafe address all go through', async () => {
    const ip = uniqueIp();
    for (let i = 0; i < 45; i++) {
      const t = await freshTable();
      const res = await requestPOST(req('/api/guest/request', { slug: w.A.slug, token: t.token, type: 'waiter', reason: 'water' }, { ip }));
      expect(res.status, `request ${i}`).toBe(200);
    }
  });

  it('other kinds of business errors (e.g. a sold-out dish) do not count towards the guessing limit', async () => {
    const ip = uniqueIp();
    const t = await freshTable();
    for (let i = 0; i < 30; i++) {
      const res = await orderPOST(req('/api/guest/order', orderBody(t, { items: [{ item_id: w.A.soldOut, qty: 1 }] }), { ip }));
      expect(res.status).toBe(409);
    }
  });

  it('turns unexpected database failures into a generic 500 with a request id (no internals leaked)', async () => {
    const t = await freshTable();
    state.forceError = { code: 'XX000', message: 'relation "secret_internal_table" exploded at 10.0.0.5' };
    const res = await orderPOST(req('/api/guest/order', orderBody(t)));
    const text = JSON.stringify(await json(res));
    expect(res.status).toBe(500);
    expect(text).toContain('server_error');
    expect(text).not.toMatch(/secret_internal_table|10\.0\.0\.5|exploded/);
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('GET /api/guest/status', () => {
  const get = (cookie: string | undefined, slug: string | null = w.A.slug) => statusGET(req(`/api/guest/status${slug ? `?slug=${slug}` : ''}`, undefined, { cookie }));

  it('requires the signed cookie: none, forged, expired, wrong restaurant, wrong key', async () => {
    const t = await freshTable();
    const placed = await orderPOST(req('/api/guest/order', orderBody(t)));
    const cookie = cookieFrom(placed)!;
    const sid = (await db.admin<{ session_id: string }>(`select session_id from public.orders where table_id = $1`, [t.id]))[0]!.session_id;
    const now = Math.floor(Date.now() / 1000);

    expect((await get(undefined)).status).toBe(401);
    expect((await get('gm_sid=garbage')).status).toBe(401);
    expect((await get(`gm_sid=${signGuestCookie({ sessionId: sid, slug: w.A.slug, exp: now + 600 }, 'attacker-secret-attacker-secret-attacker')}`)).status).toBe(401);
    expect((await get(`gm_sid=${signGuestCookie({ sessionId: sid, slug: w.A.slug, exp: now - 5 }, SECRET)}`)).status).toBe(401);
    // a valid cookie for restaurant A is useless when asking about restaurant B
    expect((await get(cookie, w.B.slug)).status).toBe(401);
    expect((await get(cookie, null)).status).toBe(401);
    // tampered: flip a character of the signature
    expect((await get(cookie.slice(0, -2) + (cookie.endsWith('A') ? 'B' : 'A') + cookie.slice(-1))).status).toBe(401);
    const ok = await get(cookie);
    expect(ok.status).toBe(200);
  });

  it('returns live orders, running total and requests, and never the QR token', async () => {
    const t = await freshTable();
    const cookie = cookieFrom(await orderPOST(req('/api/guest/order', orderBody(t, { items: [{ item_id: w.A.paneer, qty: 1 }, { item_id: w.A.chai, qty: 2 }] }))))!;
    await requestPOST(req('/api/guest/request', { slug: w.A.slug, token: t.token, type: 'waiter', reason: 'water' }, { cookie }));
    const res = await get(cookie);
    const b = await json(res);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(b.state).toBe('open');
    expect(b.total_paise).toBe(31000);
    expect(b.orders[0].items.length).toBe(2);
    expect(b.requests[0]).toMatchObject({ type: 'waiter', reason: 'water' });
    expect(JSON.stringify(b)).not.toContain(t.token);
    // staff progress is visible
    const oid = (await db.admin<{ id: string }>(`select id from public.orders where table_id = $1`, [t.id]))[0]!.id;
    await db.as('authenticated', w.A.kitchen, `select public.staff_set_order_status($1,'preparing')`, [oid]);
    expect((await json(await get(cookie))).orders[0].status).toBe('preparing');
  });

  it('shows the thank-you state after the table is closed, then expires', async () => {
    const t = await freshTable();
    const cookie = cookieFrom(await orderPOST(req('/api/guest/order', orderBody(t))))!;
    const sid = (await db.admin<{ session_id: string }>(`select session_id from public.orders where table_id = $1`, [t.id]))[0]!.session_id;
    await db.as('authenticated', w.A.owner, `select public.staff_close_session($1, true, 'test')`, [sid]);
    const b = await json(await get(cookie));
    expect(b).toMatchObject({ state: 'closed', total_paise: 6000, review_available: true });
    await db.admin(`update public.table_sessions set opened_at = now() - interval '3 hours', closed_at = now() - interval '45 minutes' where id = $1`, [sid]);
    expect((await json(await get(cookie))).state).toBe('expired');
  });

  it('a closed session can no longer be used to order; a fresh scan starts a new session', async () => {
    const t = await freshTable();
    const first = await orderPOST(req('/api/guest/order', orderBody(t)));
    const oldCookie = cookieFrom(first)!;
    const sid = (await db.admin<{ session_id: string }>(`select session_id from public.orders where table_id = $1`, [t.id]))[0]!.session_id;
    await db.as('authenticated', w.A.owner, `select public.staff_close_session($1, true, 'test')`, [sid]);
    const again = await orderPOST(req('/api/guest/order', orderBody(t), { cookie: oldCookie }));
    expect(again.status).toBe(200);
    const newSid = (await db.admin<{ session_id: string }>(`select session_id from public.orders where table_id = $1 order by created_at desc limit 1`, [t.id]))[0]!.session_id;
    expect(newSid).not.toBe(sid);
  });

  it('is rate limited per session (not per IP): 40 per minute', async () => {
    const t = await freshTable();
    const cookie = cookieFrom(await orderPOST(req('/api/guest/order', orderBody(t))))!;
    let last = 0;
    for (let i = 0; i < 42; i++) last = (await get(cookie)).status;
    expect(last).toBe(429);
    // a different session behind the same IP is unaffected
    const t2 = await freshTable();
    const c2 = cookieFrom(await orderPOST(req('/api/guest/order', orderBody(t2))))!;
    expect((await get(c2)).status).toBe(200);
  });

  it('rejects POST', async () => {
    expect((await statusGET(req('/api/guest/status?slug=x-y', {}))).status).toBe(405);
  });
});

describe('POST /api/guest/request', () => {
  const ask = (body: Record<string, unknown>, o = {}) => requestPOST(req('/api/guest/request', body, o));

  it('calls the waiter before any order, sets the cookie, and is idempotent', async () => {
    const t = await freshTable();
    const a = await ask({ slug: w.A.slug, token: t.token, type: 'waiter', reason: 'water' });
    expect(a.status).toBe(200);
    expect(cookieFrom(a)).toBeTruthy();
    const b = await ask({ slug: w.A.slug, token: t.token, type: 'waiter', reason: 'cutlery' });
    expect((await json(b)).request.reason).toBe('water');
    const [n] = await db.admin<{ n: number }>(`select count(*)::int n from public.service_requests where table_id = $1 and status = 'open'`, [t.id]);
    expect(n!.n).toBe(1);
  });

  it('asks for the bill with each payment mode, and lets the guest change it while open', async () => {
    const t = await freshTable();
    await orderPOST(req('/api/guest/order', orderBody(t)));
    for (const mode of ['cash', 'upi', 'card']) {
      const res = await ask({ slug: w.A.slug, token: t.token, type: 'bill', pay_mode: mode });
      expect((await json(res)).request).toMatchObject({ type: 'bill', pay_mode: mode, status: 'open' });
    }
    const [n] = await db.admin<{ n: number }>(`select count(*)::int n from public.service_requests where table_id = $1 and type = 'bill' and status = 'open'`, [t.id]);
    expect(n!.n).toBe(1);
  });

  it('refuses a bill before anything is ordered', async () => {
    const t = await freshTable();
    const res = await ask({ slug: w.A.slug, token: t.token, type: 'bill', pay_mode: 'cash' });
    expect(res.status).toBe(409);
    expect((await json(res)).error.key).toBe('no_orders');
  });

  it('validates input, origin, content type and tokens', async () => {
    const t = await freshTable();
    expect((await ask({ slug: w.A.slug, token: t.token, type: 'waiter', reason: 'dance' })).status).toBe(400);
    expect((await ask({ slug: w.A.slug, token: t.token, type: 'bill', pay_mode: 'bitcoin' })).status).toBe(400);
    expect((await ask({ slug: w.A.slug, token: t.token, type: 'bill', reason: 'water' })).status).toBe(400);
    expect((await ask({ slug: w.A.slug, token: t.token, type: 'waiter', reason: 'water' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await ask({ slug: w.A.slug, token: t.token, type: 'waiter', reason: 'water' }, { contentType: 'text/plain' })).status).toBe(415);
    expect((await ask({ slug: w.A.slug, token: 'e'.repeat(64), type: 'waiter', reason: 'water' })).status).toBe(403);
  });

  it('rejects requests for a rotated (old) QR', async () => {
    const t = await freshTable();
    await db.as('authenticated', w.A.owner, `select public.mgr_rotate_table_token($1)`, [t.id]);
    const res = await ask({ slug: w.A.slug, token: t.token, type: 'waiter', reason: 'water' });
    expect(res.status).toBe(403);
    expect((await json(res)).error.key).toBe('invalid_table_token');
  });
});

describe('GET /api/guest/review', () => {
  const go = (cookie?: string) => reviewGET(req('/api/guest/review', undefined, { cookie }));

  it('needs the cookie; refuses while the table is still open; after payment records the tap and redirects', async () => {
    const t = await freshTable();
    expect((await go()).status).toBe(401);
    const cookie = cookieFrom(await orderPOST(req('/api/guest/order', orderBody(t))))!;
    expect((await go(cookie)).status).toBe(404); // not paid yet
    const sid = (await db.admin<{ session_id: string }>(`select session_id from public.orders where table_id = $1`, [t.id]))[0]!.session_id;
    await db.as('authenticated', w.A.waiter, `select public.staff_close_session($1, false, null, null)`, [sid]).catch(() => undefined);
    await db.as('authenticated', w.A.owner, `select public.staff_close_session($1, true, 'test')`, [sid]);
    const res = await go(cookie);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`https://g.page/r/${w.A.slug}/review`);
    const [n] = await db.admin<{ n: number }>(`select count(*)::int n from public.review_clicks where session_id = $1`, [sid]);
    expect(n!.n).toBe(1);
  });

  it('a forged cookie cannot record clicks', async () => {
    const res = await go(`gm_sid=${signGuestCookie({ sessionId: randomUUID(), slug: w.A.slug, exp: Math.floor(Date.now() / 1000) + 600 }, 'attacker-secret-attacker-secret-attacker')}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('reports up/down without internals', async () => {
    const ok = await healthGET();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    state.forceError = { code: 'XX000', message: 'connection to 10.1.2.3 refused' };
    const down = await healthGET();
    expect(down.status).toBe(503);
    expect(JSON.stringify(await down.json())).not.toContain('10.1.2.3');
  });
});

describe('server-only secrets never appear in responses', () => {
  it('responses do not echo the cookie secret or service key', async () => {
    const t = await freshTable();
    const res = await orderPOST(req('/api/guest/order', orderBody(t)));
    const all = JSON.stringify(await json(res)) + [...res.headers.entries()].map(([k, v]) => (k === 'set-cookie' ? '' : v)).join('');
    for (const s of [SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY!, process.env.IP_HASH_SALT!]) expect(all).not.toContain(s);
  });
});
