import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '../../supabase/tests/helpers/db';
import { buildWorld, type World } from '../../supabase/tests/helpers/fixtures';
import { totp } from '../../supabase/tests/helpers/totp';
import { authState, req, state, uniqueIp } from './helpers';
import { GET as adminGET, POST as adminPOST } from '@/app/api/admin/[action]/route';
import { POST as enrollPOST } from '@/app/api/auth/mfa/enroll/route';
import { POST as verifyPOST } from '@/app/api/auth/mfa/verify/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { GET as dashGET } from '@/app/api/dash/[action]/route';
import { GET as boardGET } from '@/app/api/staff/board/route';

vi.mock('@/lib/supabase/admin', async () => {
  const h = await import('./helpers');
  return { adminClient: () => h.fakeAdminClient };
});
vi.mock('@/lib/supabase/server', async () => {
  const h = await import('./helpers');
  return { userClient: async () => h.fakeUserClient };
});

let db: TestDb;
let w: World;
beforeAll(async () => {
  db = await createTestDb();
  state.pool = db.pool;
  w = await buildWorld(db);
});
afterAll(async () => db.close());
beforeEach(() => {
  authState.userId = null;
  authState.aal = 'aal2';
  authState.factors.clear();
  authState.deleted.length = 0;
});

const as = (uid: string | null, aal: 'aal1' | 'aal2' = 'aal2') => {
  authState.userId = uid;
  authState.aal = aal;
};
const json = async (r: Response) => (await r.json()) as Record<string, any>;
const aCtx = (a: string) => ({ params: Promise.resolve({ action: a }) });
const aPost = (a: string, body: unknown, o = {}) => adminPOST(req(`/api/admin/${a}`, body, o), aCtx(a));
import { POST as dashPOST } from '@/app/api/dash/[action]/route';
const adminlessPost = (a: string, body: unknown) => dashPOST(req(`/api/dash/${a}`, body), aCtx(a));
const aGet = (a: string, q = '') => adminGET(req(`/api/admin/${a}${q}`), aCtx(a));

describe('restaurant staff need only email + password', () => {
  it('owners, managers, waiters and kitchen work with a password-only session (aal1)', async () => {
    for (const uid of [w.A.owner, w.A.manager]) {
      as(uid, 'aal1');
      expect((await dashGET(req('/api/dash/menu'), aCtx('menu'))).status).toBe(200);
      expect((await boardGET(req('/api/staff/board'))).status).toBe(200);
    }
    for (const uid of [w.A.waiter, w.A.kitchen]) {
      as(uid, 'aal1');
      expect((await boardGET(req('/api/staff/board'))).status).toBe(200);
    }
  });
  it('roles still apply: waiters and strangers cannot use the dashboard', async () => {
    for (const uid of [w.A.waiter, w.stranger]) {
      as(uid, 'aal1');
      expect((await dashGET(req('/api/dash/menu'), aCtx('menu'))).status).toBe(403);
    }
  });
});

describe('authenticator setup and verification routes', () => {
  const enroll = () => enrollPOST(req('/api/auth/mfa/enroll', {}));
  const verify = (factor_id: string, code: string) => verifyPOST(req('/api/auth/mfa/verify', { factor_id, code }, { ip: uniqueIp() }));

  it('need a session and our origin', async () => {
    expect((await enroll()).status).toBe(401);
    as(w.A.owner, 'aal1');
    expect((await enrollPOST(req('/api/auth/mfa/enroll', {}, { origin: 'https://evil.example' }))).status).toBe(403);
  });
  it('set up once: the right code lifts the session to aal2; a second setup is refused', async () => {
    as(w.A.owner, 'aal1');
    const r = await enroll();
    expect(r.status).toBe(200);
    const { factor_id, secret, qr_code } = await json(r);
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    expect(qr_code).toMatch(/^data:image\/svg\+xml/);
    expect((await verify(factor_id, '000000')).status).toBe(401);
    expect(authState.aal).toBe('aal1');
    expect((await verify(factor_id, totp(secret))).status).toBe(200);
    expect(authState.aal).toBe('aal2');
    expect((await enroll()).status).toBe(409);
  });
  it('abandoned setups are replaced, so only one pending factor exists', async () => {
    as(w.A.manager, 'aal1');
    await enroll();
    await enroll();
    expect(authState.factors.get(w.A.manager)!.length).toBe(1);
  });
  it('after 5 wrong codes even the right code is refused for a while (no guessing 6 digits)', async () => {
    as(w.B.owner, 'aal1');
    const { factor_id, secret } = await json(await enroll());
    for (let i = 0; i < 5; i++) expect((await verify(factor_id, '111111')).status).toBe(401);
    const blocked = await verify(factor_id, totp(secret));
    expect(blocked.status).toBe(429);
    expect(authState.aal).toBe('aal1');
  });
  it('rejects codes that are not six digits and factors that are not yours', async () => {
    as(w.A.waiter, 'aal1');
    const { factor_id } = await json(await enroll());
    expect((await verify(factor_id, 'abcdef')).status).toBe(400);
    expect((await verify('3f2504e0-4f89-41d3-9a0c-0305e82c3301', '123456')).status).toBe(404);
  });
});

describe('platform admin API', () => {
  it('needs sign-in, then the platform_admins row (password only, no authenticator)', async () => {
    expect((await aGet('restaurants')).status).toBe(401);
    as(w.admin, 'aal1');
    expect((await aGet('restaurants')).status).toBe(200);
    for (const uid of [w.A.owner, w.A.manager, w.stranger]) {
      as(uid, 'aal2');
      const x = await aGet('restaurants');
      expect(x.status, uid).toBe(403);
      expect((await json(x)).error.key).toBe('forbidden');
    }
  });
  it('lists restaurants with last activity; unknown actions 404; wrong method 405; foreign origin refused', async () => {
    as(w.admin);
    const r = await json(await aGet('restaurants'));
    expect(r.restaurants.length).toBeGreaterThanOrEqual(2);
    expect(r.restaurants[0]).toHaveProperty('last_order_at');
    expect((await aGet('nope')).status).toBe(404);
    expect((await aGet('constructor')).status).toBe(404);
    expect((await aPost('restaurants', {})).status).toBe(405);
    expect((await aPost('set-status', { id: w.A.rid, status: 'suspended' }, { origin: 'https://evil.example' })).status).toBe(403);
  });
  it('creates a restaurant and owner login with a one-time temporary password that must be changed', async () => {
    as(w.admin);
    const r = await aPost('create-restaurant', { slug: 'new-cafe', name: 'New Cafe', owner_email: 'Owner@NewCafe.test', owner_name: 'Nina', plan: 'pilot', paid_until: null });
    expect(r.status).toBe(201);
    const b = await json(r);
    expect(b.temporary_password.length).toBeGreaterThanOrEqual(14);
    expect(b.owner_email).toBe('owner@newcafe.test');
    const [owner] = await db.admin<{ role: string; user_id: string }>(`select role, user_id from public.staff where restaurant_id = $1`, [b.id]);
    expect(owner!.role).toBe('owner');
    expect(authState.meta.get(owner!.user_id)?.app_metadata).toMatchObject({ must_change_password: true });
    const [a] = await db.admin<{ action: string; actor_role: string }>(`select action, actor_role from public.audit_log where restaurant_id = $1 and action = 'restaurant_created'`, [b.id]);
    expect(a).toMatchObject({ actor_role: 'platform_admin' });
  });
  it('lists a restaurant\'s logins, resets a password and corrects an email (audit-logged, other restaurants refused)', async () => {
    as(w.admin);
    const l = await aGet('staff', `?id=${w.A.rid}`);
    expect(l.status).toBe(200);
    const { staff } = await json(l);
    const owner = staff.find((x: any) => x.role === 'owner');
    expect(staff[0].role).toBe('owner');
    expect(owner.email).toBeTruthy();
    const reset = await aPost('staff-reset-password', { id: w.A.rid, user_id: owner.user_id });
    expect(reset.status).toBe(200);
    expect((await json(reset)).temporary_password.length).toBeGreaterThanOrEqual(14);
    expect(authState.meta.get(owner.user_id)?.app_metadata).toMatchObject({ must_change_password: true });
    const ch = await aPost('staff-change-email', { id: w.A.rid, user_id: owner.user_id, email: 'New.Owner@Example.test' });
    expect(ch.status).toBe(200);
    const [row] = await db.admin<{ email: string }>(`select email from auth.users where id = $1`, [owner.user_id]);
    expect(row!.email).toBe('new.owner@example.test');
    const dup = await aPost('staff-change-email', { id: w.A.rid, user_id: owner.user_id, email: staff.find((x: any) => x.role !== 'owner')!.email });
    expect(dup.status).toBe(409);
    // a login of restaurant A cannot be touched through restaurant B
    expect((await aPost('staff-reset-password', { id: w.B.rid, user_id: owner.user_id })).status).toBe(404);
    const acts = await db.admin<{ action: string; actor_role: string }>(`select action, actor_role from public.audit_log where restaurant_id = $1 and action in ('staff_password_reset','staff_email_changed') order by id`, [w.A.rid]);
    expect(acts.map((a) => a.action)).toEqual(['staff_password_reset', 'staff_email_changed', 'staff_email_changed']); // the refused duplicate is logged as an attempt
    expect(acts.every((a) => a.actor_role === 'platform_admin')).toBe(true);
    // not for restaurant owners
    as(w.A.owner);
    expect((await aPost('staff-reset-password', { id: w.A.rid, user_id: owner.user_id })).status).toBe(403);
    expect((await aGet('staff', `?id=${w.A.rid}`)).status).toBe(403);
  });
  it('refuses duplicate slugs, reserved slugs, bad emails and does not leave a login behind', async () => {
    as(w.admin);
    const before = (await db.admin(`select 1 from auth.users`)).length;
    const dup = await aPost('create-restaurant', { slug: 'new-cafe', name: 'Again', owner_email: 'again@x.test', owner_name: 'A', plan: 'pilot', paid_until: null });
    expect(dup.status).toBe(409);
    expect((await aPost('create-restaurant', { slug: 'admin', name: 'X', owner_email: 'x@x.test', owner_name: 'A' })).status).toBe(400);
    expect((await aPost('create-restaurant', { slug: 'ok-name', name: 'X', owner_email: 'not-an-email', owner_name: 'A' })).status).toBe(400);
    expect((await aPost('create-restaurant', { slug: 'ok-name', name: 'X', owner_email: 'owner@newcafe.test', owner_name: 'A' })).status).toBe(409); // email already used
    expect((await db.admin(`select 1 from auth.users`)).length).toBe(before);
  });
  it('suspend / activate and plan changes are applied and audit-logged; suspension blocks staff writes at once', async () => {
    as(w.admin);
    expect((await aPost('set-status', { id: w.B.rid, status: 'suspended' })).status).toBe(200);
    as(w.B.owner);
    expect((await dashGET(req('/api/dash/settings'), aCtx('settings'))).status).toBe(200); // still readable
    const w2 = await adminlessPost('settings-save', { name: 'Nope', review_url: '', accent: 'teal', amber_minutes: 5, red_minutes: 10 });
    expect(w2.status).toBe(403);
    expect((await json(w2)).error.key).toBe('restaurant_suspended');
    const [s] = await db.admin<{ status: string }>(`select status from public.restaurants where id = $1`, [w.B.rid]);
    expect(s!.status).toBe('suspended');
    as(w.admin);
    expect((await aPost('set-status', { id: w.B.rid, status: 'active' })).status).toBe(200);
    expect((await aPost('set-plan', { id: w.B.rid, plan: 'standard', paid_until: '2027-03-31T18:29:59.000Z' })).status).toBe(200);
    const [p] = await db.admin<{ plan: string }>(`select plan from public.restaurants where id = $1`, [w.B.rid]);
    expect(p!.plan).toBe('standard');
    expect((await aPost('set-status', { id: w.B.rid, status: 'deleted' })).status).toBe(400);
    expect((await aPost('set-status', { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', status: 'active' })).status).toBe(404);
  });
  it('reads any restaurant\'s audit log and exports its data as a download (never QR tokens)', async () => {
    as(w.admin);
    const a = await json(await aGet('audit', `?id=${w.A.rid}`));
    expect(Array.isArray(a.entries)).toBe(true);
    expect((await aGet('audit', '?id=not-a-uuid')).status).toBe(400);
    const e = await aGet('export', `?id=${w.A.rid}`);
    expect(e.status).toBe(200);
    expect(e.headers.get('content-disposition')).toContain('attachment');
    const text = await e.text();
    expect(JSON.parse(text).restaurant.slug).toBe(w.A.slug);
    expect(text).not.toContain(w.A.t1.token);
  });
  it('deleting needs the exact typed slug; then removes the restaurant and its staff logins', async () => {
    as(w.admin);
    const c = await json(await aPost('create-restaurant', { slug: 'to-delete', name: 'Gone Soon', owner_email: 'gone@x.test', owner_name: 'G' }));
    expect((await aPost('delete-restaurant', { id: c.id, confirm_slug: 'wrong' })).status).toBe(400);
    expect((await db.admin(`select 1 from public.restaurants where id = $1`, [c.id])).length).toBe(1);
    const del = await aPost('delete-restaurant', { id: c.id, confirm_slug: 'to-delete' });
    expect(del.status).toBe(200);
    expect((await json(del)).staff_logins_removed).toBe(1);
    expect((await db.admin(`select 1 from public.restaurants where id = $1`, [c.id])).length).toBe(0);
    expect(authState.deleted.length).toBe(1);
    const [k] = await db.admin<{ action: string }>(`select action from public.audit_log where restaurant_id is null and action = 'restaurant_deleted' order by id desc limit 1`);
    expect(k!.action).toBe('restaurant_deleted');
  });
});

describe('sign-in for platform admins', () => {
  it('lets an admin (who is not restaurant staff) sign in and sends them to /admin; strangers still get the generic failure', async () => {
    const [u] = await db.admin<{ email: string }>(`select email from auth.users where id = $1`, [w.admin]);
    const ok = await loginPOST(req('/api/auth/login', { email: u!.email, password: 'correct-horse-battery-staple' }, { ip: uniqueIp() }));
    expect(ok.status).toBe(200);
    expect((await json(ok)).next).toBe('/admin');
    const [s] = await db.admin<{ email: string }>(`select email from auth.users where id = $1`, [w.stranger]);
    const no = await loginPOST(req('/api/auth/login', { email: s!.email, password: 'correct-horse-battery-staple' }, { ip: uniqueIp() }));
    expect(no.status).toBe(401);
  });
});
