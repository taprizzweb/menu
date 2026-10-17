import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { serverEnv } from '@/env';
import { ApiError, type ErrorKey } from '@/lib/errors';
import { log } from '@/lib/log';
import { MAX_BODY_BYTES, isAllowedOrigin, isJson } from '@/lib/security/origin';
import { clientIp, hashIp } from '@/lib/security/ip';

export interface Ctx {
  requestId: string;
  /** salted hash of the caller's IP; the raw address is never kept */
  ipHash: string;
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

/**
 * Wraps a guest route: request id, CSRF/origin check, JSON-only, body size cap, zod validation,
 * and uniform error mapping (no stack traces or database text ever reach the user).
 */
export async function guestRoute<B = undefined>(
  req: Request,
  opts: { method: 'GET' | 'POST'; schema?: ZodType<B>; checkOrigin?: boolean },
  run: (ctx: Ctx, body: B) => Promise<Response>,
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
    const ctx: Ctx = { requestId, ipHash: hashIp(clientIp(req.headers), env.IP_HASH_SALT) };
    const res = await run(ctx, body);
    res.headers.set('x-request-id', requestId);
    return res;
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.key, requestId);
    if (e instanceof ZodError) return jsonError(400, 'invalid_input', requestId);
    log('error', 'unhandled guest route error', {
      requestId,
      path: new URL(req.url).pathname,
      error: e instanceof Error ? e.message : String(e),
      dbCode: (e as { dbCode?: string }).dbCode,
    });
    return jsonError(500, 'server_error', requestId);
  }
}
