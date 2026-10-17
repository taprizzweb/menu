/**
 * Local development/test stack that needs nothing but Postgres:
 *   1. creates a fresh database from the migrations and fills it with the demo restaurants,
 *   2. serves the SQL functions over HTTP in the shape Supabase's REST API uses (POST /rest/v1/rpc/<name>),
 *      so the real Next.js server runs unchanged against real SQL.
 * It prints the environment variables to start the app with. NOT used in production.
 *
 *   tsx scripts/dev-stack.ts            (keeps running; Ctrl+C to stop and drop the database)
 */
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { createTestDb } from '../supabase/tests/helpers/db';
import { callRpc } from '../supabase/tests/helpers/rpc';
import { localUserCreator, seedDemo } from '../supabase/seed/seed';

const PORT = Number(process.env.SHIM_PORT ?? 54321);

async function main() {
  const db = await createTestDb();
  const seeded = await seedDemo(db.pool, { createUser: localUserCreator(db.pool) });
  writeFileSync(process.env.DEV_STACK_INFO ?? '/tmp/gotomenu-dev-stack.json', JSON.stringify({ db: db.name, port: PORT, seeded }, null, 2));

  const server = createServer(async (req, res) => {
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(req.url ?? '');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (!m || req.method !== 'POST') {
      res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ message: 'not found' }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const args = chunks.length ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>) : {};
    const r = await callRpc(db.pool, 'service_role', m[1]!, args);
    if (r.error) {
      res.writeHead(r.error.code === '42501' ? 403 : 400, { 'content-type': 'application/json' }).end(JSON.stringify(r.error));
    } else {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(r.data));
    }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`dev stack ready: database ${db.name}, REST shim on http://127.0.0.1:${PORT}`);
    console.log(`demo tables and tokens written to ${process.env.DEV_STACK_INFO ?? '/tmp/gotomenu-dev-stack.json'}`);
  });
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
