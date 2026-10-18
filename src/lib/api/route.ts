import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { serverEnv } from '@/env';
import { ApiError, type ErrorKey } from '@/lib/errors';
import { log } from '@/lib/log';
import { MAX_BODY_BYTES, isAllowedOrigin, isJson } from '@/lib/security/origin';
import { clientIp, hashIp } from '@/lib/security/ip';
import { userClient } from '@/lib/supabase/server';

export interface Ctx {
  requestId: string;
  /** salted hash of the caller's IP; the raw address is never kept */
  ipHash: string;
}

export interface StaffCtx extends Ctx {
  userId: string;
  /** database client that acts as the signed-in staff member (RLS + role checks apply) */
  db: SupabaseClient;
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function jsonError(status: number, key: ErrorKey, requestId: string): NextResponse {
  return NextResponse.json({ error: { key }, requestId }, { status, headers: { ...NO_STORE, 'x-request-id': requestId } });
}

export function jsonOk(data: unknown, requestId: string, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(data, { status: init.status ?? 200, headers: { ...NO_STORE, 'x-request-id': requestId } });
}

async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large');
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'invalid_input');
  }
}

interface Options<B> {
  method: 'GET' | 'POST';
  schema?: ZodType<B>;
  checkOrigin?: boolean;
  /** Only the "choose your own password" route sets this: everything else is refused until a temporary password is replaced. */
  allowTempPassword?: boolean;
}

/**
 * Shared guard for every API route: request id, CSRF/origin check, JSON-only, body size cap, zod validation and
 * uniform error mapping (no stack traces or database text ever reach the user). `authenticate` adds the signed-in user.
 */
async function guarded<B, C extends Ctx>(
  req: Request,
  opts: Options<B>,
  authenticate: ((ctx: Ctx) => Promise<C>) | null,
  run: (ctx: C, body: B) => Promise<Response>,
): Promise<Response> {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const env = serverEnv();
    if (req.method !== opts.method) throw new ApiError(405, 'method_not_allowed');
    if ((opts.method === 'POST' || opts.checkOrigin) && !isAllowedOrigin(req.headers, env.NEXT_PUBLIC_APP_ORIGIN)) {
      throw new ApiError(403, 'origin_not_allowed');
    }
    let body = undefined as B;
    if (opts.method === 'POST') {
      if (!isJson(req.headers)) throw new ApiError(415, 'unsupported_media_type');
      const raw = await readJson(req);
      body = opts.schema ? opts.schema.parse(raw) : (raw as B);
    }
    const base: Ctx = { requestId, ipHash: hashIp(clientIp(req.headers), env.IP_HASH_SALT) };
    const ctx = authenticate ? await authenticate(base) : (base as C);
    const res = await run(ctx, body);
    res.headers.set('x-request-id', requestId);
    return res;
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.key, requestId);
    if (e instanceof ZodError) return jsonError(400, 'invalid_input', requestId);
    log('error', 'unhandled route error', {
      requestId,
      path: new URL(req.url).pathname,
      error: e instanceof Error ? e.message : String(e),
      dbCode: (e as { dbCode?: string }).dbCode,
    });
    return jsonError(500, 'server_error', requestId);
  }
}

/** Public (guest) route. */
export function guestRoute<B = undefined>(req: Request, opts: Options<B>, run: (ctx: Ctx, body: B) => Promise<Response>): Promise<Response> {
  return guarded<B, Ctx>(req, opts, null, run);
}

/** Staff route: the caller must be signed in (verified with getUser()); the handler gets a database client acting as them. */
export function staffRoute<B = undefined>(req: Request, opts: Options<B>, run: (ctx: StaffCtx, body: B) => Promise<Response>): Promise<Response> {
  return guarded<B, StaffCtx>(
    req,
    opts,
    async (ctx) => {
      const db = await userClient();
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) throw new ApiError(401, 'unauthorized');
      if (!opts.allowTempPassword && data.user.app_metadata?.must_change_password === true) throw new ApiError(403, 'password_change_required');
      return { ...ctx, userId: data.user.id, db };
    },
    run,
  );
}
