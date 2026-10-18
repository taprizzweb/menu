/**
 * Local development/test stack that needs nothing but Postgres:
 *   1. creates a fresh database from the migrations and fills it with the demo restaurants,
 *   2. serves a local stand-in for Supabase's login and SQL-function endpoints (see supabase/tests/helpers/local-supabase.ts),
 *      so the real Next.js server runs unchanged against real SQL.
 * It prints the environment variables to start the app with. NOT used in production.
 *
 *   tsx scripts/dev-stack.ts            (keeps running; Ctrl+C to stop and drop the database)
 */
import { writeFileSync } from 'node:fs';
import { createTestDb } from '../supabase/tests/helpers/db';
import { startLocalSupabase, DEMO_PASSWORD } from '../supabase/tests/helpers/local-supabase';
import { DEMO_TOTP_SECRET } from '../supabase/tests/helpers/totp';
import { localUserCreator, seedDemo } from '../supabase/seed/seed';

const PORT = Number(process.env.SHIM_PORT ?? 54321);

async function main() {
  const db = await createTestDb();
  const seeded = await seedDemo(db.pool, { createUser: localUserCreator(db.pool) });
  // only the platform admin must use a second factor: give that demo account an authenticator with a known secret
  await db.pool.query(
    `insert into auth.mfa_factors (user_id, friendly_name, status, secret)
     select id, 'demo phone', 'verified', $1 from auth.users where email = 'admin@gotomenu.demo'`,
    [DEMO_TOTP_SECRET],
  );
  writeFileSync(process.env.DEV_STACK_INFO ?? '/tmp/gotomenu-dev-stack.json', JSON.stringify({ db: db.name, port: PORT, seeded }, null, 2));

  const server = await startLocalSupabase(db.pool, PORT);
  console.log(`dev stack ready: database ${db.name}, local Supabase stand-in on http://127.0.0.1:${PORT}`);
  console.log(`demo logins (password ${DEMO_PASSWORD}): owner@spice-garden.demo, manager@..., waiter@..., kitchen@... (also @cafe-aroma.demo), admin@gotomenu.demo.\nthe admin also needs the authenticator code: secret ${DEMO_TOTP_SECRET}`);
  const stop = async () => {
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
