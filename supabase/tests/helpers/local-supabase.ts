/**
 * LOCAL STAND-IN for the parts of Supabase the app talks to over HTTP (never used in production):
 *   POST /auth/v1/token?grant_type=password|refresh_token   email + password login, signed JWT access tokens
 *   GET  /auth/v1/user                                      who does this token belong to
 *   POST /auth/v1/logout
 *   POST /rest/v1/rpc/<function>                            SQL functions, run as the role the token proves
 * Role mapping mirrors Supabase: service key => service_role, a valid user JWT => authenticated, else anon.
 * Realtime is not emulated (the app falls back to polling, which is also what runs if Realtime is down).
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import type { Pool } from 'pg';
import { callRpc } from './rpc';

export const LOCAL_JWT_SECRET = 'local-jwt-secret-local-jwt-secret-1234567890';
export const LOCAL_SERVICE_KEY = 'local-service-role-key-local-service-role';
export const LOCAL_ANON_KEY = 'local-anon-key-local-anon-key-local';
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'DemoPass#2025!';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function signJwt(claims: Record<string, unknown>): string {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}`;
  return `${body}.${createHmac('sha256', LOCAL_JWT_SECRET).update(body).digest('base64url')}`;
}

export function verifyJwt(token: string): Record<string, any> | null {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const expected = createHmac('sha256', LOCAL_JWT_SECRET).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, any>;
  return typeof claims.exp === 'number' && claims.exp > Date.now() / 1000 ? claims : null;
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function startLocalSupabase(pool: Pool, port: number, opts: { ttlSeconds?: number } = {}): Promise<Server> {
  const ttl = opts.ttlSeconds ?? 3600;
  const refreshTokens = new Map<string, string>(); // refresh token -> user id

  const userJson = (id: string, email: string) => ({ id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  const session = (id: string, email: string) => {
    const now = Math.floor(Date.now() / 1000);
    const refresh = randomUUID();
    refreshTokens.set(refresh, id);
    return {
      access_token: signJwt({ sub: id, email, role: 'authenticated', aud: 'authenticated', aal: 'aal1', iat: now, exp: now + ttl }),
      token_type: 'bearer', expires_in: ttl, expires_at: now + ttl, refresh_token: refresh, user: userJson(id, email),
    };
  };

  const send = (res: ServerResponse, status: number, body: unknown, origin?: string) => {
    res.writeHead(status, {
      'content-type': 'application/json',
      ...(origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'origin' } : {}),
    });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': origin ?? '*', 'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, x-supabase-api-version, prefer',
          'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '600',
        });
        res.end();
        return;
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];

      if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
        const body = await readBody(req);
        const grant = url.searchParams.get('grant_type');
        if (grant === 'password') {
          const { rows } = await pool.query<{ id: string; email: string }>(`select id, email from auth.users where email = $1`, [String(body.email ?? '').toLowerCase()]);
          const u = rows[0];
          if (!u || body.password !== DEMO_PASSWORD) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, origin);
          return send(res, 200, session(u.id, u.email), origin);
        }
        if (grant === 'refresh_token') {
          const id = refreshTokens.get(String(body.refresh_token));
          if (!id) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, origin);
          refreshTokens.delete(String(body.refresh_token));
          const { rows } = await pool.query<{ email: string }>(`select email from auth.users where id = $1`, [id]);
          return send(res, 200, session(id, rows[0]!.email), origin);
        }
        return send(res, 400, { msg: 'unsupported grant' }, origin);
      }
      if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
        const claims = bearer ? verifyJwt(bearer) : null;
        if (!claims || claims.role !== 'authenticated') return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }, origin);
        return send(res, 200, userJson(claims.sub, claims.email), origin);
      }
      if (url.pathname === '/auth/v1/logout' && req.method === 'POST') return send(res, 204, undefined, origin);

      const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
      if (m && req.method === 'POST') {
        let role: 'service_role' | 'authenticated' | 'anon' = 'anon';
        let sub: string | undefined;
        if (bearer === LOCAL_SERVICE_KEY) role = 'service_role';
        else if (bearer && bearer !== LOCAL_ANON_KEY) {
          const claims = verifyJwt(bearer);
          if (!claims) return send(res, 401, { code: 'PGRST301', message: 'JWT invalid or expired' }, origin);
          role = 'authenticated';
          sub = claims.sub;
        }
        const r = await callRpc(pool, role, m[1]!, await readBody(req), sub);
        if (r.error) return send(res, r.error.code === '42501' ? 403 : 400, r.error, origin);
        return send(res, 200, r.data, origin);
      }
      send(res, 404, { message: 'not found' }, origin);
    } catch (e) {
      send(res, 500, { message: String(e) }, origin);
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
