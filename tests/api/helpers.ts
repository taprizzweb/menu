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
