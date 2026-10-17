/** Browser-side helpers for the guest API. No secrets here: the only credential is the HttpOnly cookie the browser sends itself. */
import type { PayMode, StatusData, WaiterReason } from './types';

export class ApiFailure extends Error {
  constructor(
    public readonly key: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(key);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  } catch {
    throw new ApiFailure('network', 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const b = body as { error?: { key?: string }; requestId?: string } | null;
    throw new ApiFailure(b?.error?.key ?? 'server_error', res.status, b?.requestId ?? res.headers.get('x-request-id') ?? undefined);
  }
  return body as T;
}

const post = <T>(path: string, data: unknown) =>
  call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export interface PlaceOrderInput {
  slug: string;
  token: string;
  items: { item_id: string; qty: number; note?: string }[];
  note?: string;
  idempotency_key: string;
}
export const placeOrder = (input: PlaceOrderInput) =>
  post<{ order_no: number; total_paise: number; status: string; replayed: boolean }>('/api/guest/order', input);

export const callWaiter = (slug: string, token: string, reason: WaiterReason) =>
  post<{ request: { type: string; status: string } }>('/api/guest/request', { type: 'waiter', slug, token, reason });

export const askBill = (slug: string, token: string, payMode: PayMode) =>
  post<{ request: { type: string; status: string; pay_mode: PayMode } }>('/api/guest/request', { type: 'bill', slug, token, pay_mode: payMode });

export const fetchStatus = (slug: string, signal?: AbortSignal) => call<StatusData>(`/api/guest/status?slug=${encodeURIComponent(slug)}`, { signal });
