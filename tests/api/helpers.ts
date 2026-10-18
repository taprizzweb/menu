import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { callRpc } from '../../supabase/tests/helpers/rpc';

export const APP = 'https://gotomenu.taprizz.in';

export const state = {
  pool: null as null | Pool,
  /** when set, the next rpc fails with this database error (simulates an unexpected failure) */
  forceError: null as null | { code: string; message: string },
  calls: [] as string[],
};

/** What the server code gets instead of the real Supabase client: same rpc() contract, real SQL underneath. */
export const fakeAdminClient = {
  auth: {
    admin: {
      createUser: async ({ email, password, app_metadata }: { email: string; password: string; app_metadata?: Record<string, unknown> }) => {
        const exists = await state.pool!.query(`select 1 from auth.users where email = $1`, [email]);
        if (exists.rowCount) return { data: { user: null }, error: { status: 422, message: 'A user with this email address has already been registered' } };
        const r = await state.pool!.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
        const id = r.rows[0]!.id;
        authState.meta.set(id, { password, app_metadata: app_metadata ?? {} });
        return { data: { user: { id } }, error: null };
      },
      updateUserById: async (id: string, attrs: { password?: string; app_metadata?: Record<string, unknown> }) => {
        const m = authState.meta.get(id) ?? { app_metadata: {} };
        authState.meta.set(id, { password: attrs.password ?? m.password, app_metadata: { ...m.app_metadata, ...(attrs.app_metadata ?? {}) } });
        return { data: { user: { id } }, error: null };
      },
      deleteUser: async (id: string) => {
        authState.deleted.push(id);
        await state.pool!.query(`delete from auth.users where id = $1`, [id]);
        return { data: {}, error: null };
      },
    },
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    state.calls.push(name);
    if (state.forceError) {
      const e = state.forceError;
      state.forceError = null;
      return { data: null, error: e };
    }
    return callRpc(state.pool!, 'service_role', name, args);
  },
};

/** The signed-in staff member for the next request (what the session cookie would prove). */
export const authState = {
  userId: null as string | null,
  signOuts: [] as string[],
  /** per-user login details the fake Auth service remembers (password and server-only metadata) */
  meta: new Map<string, { password?: string; app_metadata: Record<string, unknown> }>(),
  deleted: [] as string[],
};

/**
 * Stand-in for the cookie-based Supabase client: getUser() answers with `authState.userId`, rpc() runs the real SQL
 * as that user (authenticated role), and signInWithPassword() accepts the demo password for any existing auth user.
 */
export const fakeUserClient = {
  auth: {
    getUser: async () =>
      authState.userId
        ? { data: { user: { id: authState.userId, app_metadata: authState.meta.get(authState.userId)?.app_metadata ?? {} } }, error: null }
        : { data: { user: null }, error: { status: 401, message: 'no session' } },
    updateUser: async ({ password }: { password?: string }) => {
      if (!authState.userId) return { data: { user: null }, error: { status: 401, message: 'no session' } };
      if (password && /^(password|123456)/i.test(password)) return { data: { user: null }, error: { status: 422, message: 'Password is known to be weak and easy to guess' } };
      const m = authState.meta.get(authState.userId) ?? { app_metadata: {} };
      authState.meta.set(authState.userId, { ...m, password: password ?? m.password });
      return { data: { user: { id: authState.userId } }, error: null };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const r = await state.pool!.query<{ id: string }>(`select id from auth.users where email = $1`, [email]);
      if (r.rowCount === 0 || password !== 'correct-horse-battery-staple') return { data: { session: null }, error: { status: 400, message: 'Invalid login credentials' } };
      authState.userId = r.rows[0]!.id;
      return { data: { session: {} }, error: null };
    },
    signOut: async (o?: { scope?: string }) => {
      authState.signOuts.push(o?.scope ?? 'global');
      authState.userId = null;
      return { error: null };
    },
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    state.calls.push(name);
    if (!authState.userId) return { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    return callRpc(state.pool!, 'authenticated', name, args, authState.userId);
  },
};

export interface PostOpts {
  origin?: string | null;
  referer?: string;
  contentType?: string | null;
  cookie?: string;
  ip?: string;
  rawBody?: string;
  method?: string;
}

export function req(path: string, body?: unknown, o: PostOpts = {}): Request {
  const headers = new Headers();
  if (o.origin !== null) headers.set('origin', o.origin ?? APP);
  if (o.referer) headers.set('referer', o.referer);
  if (o.contentType !== null) headers.set('content-type', o.contentType ?? 'application/json');
  if (o.cookie) headers.set('cookie', o.cookie);
  headers.set('x-forwarded-for', o.ip ?? `198.51.100.${Math.floor(Math.random() * 250) + 1}`);
  const method = o.method ?? (body === undefined && o.rawBody === undefined ? 'GET' : 'POST');
  const init: RequestInit = { method, headers };
  if (method === 'POST') init.body = o.rawBody ?? JSON.stringify(body);
  return new Request(`${APP}${path}`, init);
}

/** "gm_sid=..." pair from a response's Set-Cookie, ready to send back. */
export function cookieFrom(res: Response): string | undefined {
  const sc = res.headers.getSetCookie().find((c) => c.startsWith('gm_sid='));
  return sc?.split(';')[0];
}

export const uniqueIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 6)}`;
