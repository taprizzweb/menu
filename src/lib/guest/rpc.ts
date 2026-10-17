import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import { ApiError, fromDbError } from '@/lib/errors';

/** Calls a SECURITY DEFINER SQL function with the service-role key. Known database errors become ApiErrors. */
export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await adminClient().rpc(name, args);
  if (error) {
    const known = fromDbError(error);
    if (known) throw known;
    // Unknown: let the route handler log it with the request id; the user only ever sees a generic message.
    throw Object.assign(new Error(`rpc ${name} failed`), { dbCode: error.code });
  }
  return data as T;
}

/** Throws a 429 when `key` has used up `max` hits in `windowSeconds`. Commits independently of the caller's work. */
export async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const ok = await rpc<boolean>('guest_rate_limit', { p_key: key, p_limit: max, p_window_seconds: windowSeconds });
  if (!ok) throw new ApiError(429, 'rate_limited');
}
