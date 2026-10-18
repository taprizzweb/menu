import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './helpers/db';
import { buildWorld, rpc, rpcErr, type World } from './helpers/fixtures';

let db: TestDb;
let w: World;
beforeAll(async () => {
  db = await createTestDb();
  w = await buildWorld(db);
});
afterAll(async () => db.close());
afterEach(() => {
  db.aal = 'aal2';
});

// Every SQL function a signed-in owner/manager uses, called with a token that proves the password only.
const PRIVILEGED = [
  'public.staff_get_board()', 'public.staff_list_items()', 'public.mgr_get_menu()', 'public.mgr_get_settings()', 'public.mgr_get_staff()',
  `public.mgr_report('today')`, 'public.mgr_get_audit(10, null)', 'public.mgr_get_table_tokens()',
];

describe('owners and managers need aal2 (second factor) in the database', () => {
  it('without it, every read function says mfa_required (GM021) for owner and manager', async () => {
    db.aal = 'aal1';
    for (const uid of [w.A.owner, w.A.manager]) {
      for (const call of PRIVILEGED) {
        const e = await rpcErr(db, uid, call);
        expect(e?.code, `${call} as ${uid}`).toBe('GM021');
      }
    }
  });
  it('without it, writes are refused too (prices, availability, settings, tables, staff, order status)', async () => {
    db.aal = 'aal1';
    const writes = [
      [`public.mgr_save_category(null, 'Sneaky', true)`],
      [`public.mgr_update_settings('X', null, 'teal', 5, 10)`],
      [`public.mgr_create_tables(50, 52)`],
      [`public.staff_set_item_availability(array['${w.A.paneer}']::uuid[], false)`],
      [`public.mgr_bulk_price(array['${w.A.paneer}']::uuid[], 'percent', 50)`],
    ];
    for (const [call] of writes) expect((await rpcErr(db, w.A.owner, call!))?.code, call).toBe('GM021');
    db.aal = 'aal2';
    const [p] = await db.admin<{ price_paise: number; is_available: boolean }>(`select price_paise, is_available from public.items where id = $1`, [w.A.paneer]);
    expect(p).toMatchObject({ is_available: true });
    expect((await db.admin(`select 1 from public.categories where name_en = 'Sneaky'`)).length).toBe(0);
  });
  it('without it, row-level security shows an owner nothing at all', async () => {
    db.aal = 'aal1';
    for (const t of ['items', 'orders', 'staff', 'categories', 'dining_tables', 'audit_log']) {
      expect((await db.as('authenticated', w.A.owner, `select count(*)::int n from public.${t}`))[0]!.n, t).toBe(0);
    }
    db.aal = 'aal2';
    expect((await db.as('authenticated', w.A.owner, `select count(*)::int n from public.items`))[0]!.n).toBeGreaterThan(0);
  });
  it('with aal2 the same calls work', async () => {
    db.aal = 'aal2';
    for (const call of PRIVILEGED) expect(await rpcErr(db, w.A.owner, call), call).toBeNull();
  });
  it('waiters and kitchen staff are unaffected by the assurance level', async () => {
    db.aal = 'aal1';
    for (const uid of [w.A.waiter, w.A.kitchen]) {
      expect(await rpcErr(db, uid, 'public.staff_get_board()')).toBeNull();
      expect(await rpcErr(db, uid, 'public.staff_list_items()')).toBeNull();
    }
    expect((await db.as('authenticated', w.A.waiter, `select count(*)::int n from public.orders`))[0]!.n).toBeGreaterThanOrEqual(0);
  });
  it('staff_me still answers at aal1, so the app can tell who must complete the second step', async () => {
    db.aal = 'aal1';
    expect(((await rpc(db, w.A.owner, 'public.staff_me()'))[0]!.r as { role: string }).role).toBe('owner');
  });
  it('a token with no aal claim at all counts as aal1 (fails closed)', async () => {
    const c = await db.pool.connect();
    try {
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: w.A.owner, role: 'authenticated' })]);
      await expect(c.query('select public.mgr_get_menu()')).rejects.toMatchObject({ code: 'GM021' });
    } finally {
      await c.query('rollback');
      c.release();
    }
  });
  it('photo storage rules need aal2 as well', async () => {
    const attempt = (aal: 'aal1' | 'aal2') => {
      db.aal = aal;
      return db.asErr('authenticated', w.A.owner, `insert into storage.objects (bucket_id, name, owner) values ('menu-images', '${w.A.rid}/x-${aal}.webp', '${w.A.owner}')`);
    };
    expect(await attempt('aal1')).not.toBeNull();
    expect(await attempt('aal2')).toBeNull();
  });
});

describe('admin_check', () => {
  it('is callable by the server (service role) only', async () => {
    expect((await db.as('service_role', null, `select public.admin_check($1) as r`, [w.admin]))[0]!.r).toBe(true);
    expect((await db.as('service_role', null, `select public.admin_check($1) as r`, [w.A.owner]))[0]!.r).toBe(false);
    expect((await db.asErr('authenticated', w.A.owner, `select public.admin_check('${w.admin}')`))?.code).toBe('42501');
    expect((await db.asErr('anon', null, `select public.admin_check('${w.admin}')`))?.code).toBe('42501');
  });
});
