export interface CspOptions {
  nonce: string;
  /** Development only: allows eval (React refresh) and inline styles. Never true in production. */
  dev: boolean;
  /** e.g. https://abcd.supabase.co */
  supabaseUrl: string;
  /** Optional error-reporting ingest origin, e.g. https://o123.ingest.sentry.io */
  sentryOrigin?: string;
}

export function buildCsp({ nonce, dev, supabaseUrl, sentryOrigin }: CspOptions): string {
  const supabase = new URL(supabaseUrl);
  const supabaseHttps = `https://${supabase.host}`;
  const supabaseWss = `wss://${supabase.host}`;
  const connect = ["'self'", supabaseHttps, supabaseWss];
  if (sentryOrigin) connect.push(sentryOrigin);
  // Local Supabase runs over http/ws; only ever allowed in development.
  if (dev) connect.push(`http://${supabase.host}`, `ws://${supabase.host}`, 'ws://localhost:*', 'ws://127.0.0.1:*');

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", ...(dev ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    // Inline style="" attributes (e.g. from next/image) cannot run script; allowing them keeps images working.
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', supabaseHttps],
    'font-src': ["'self'"],
    'connect-src': connect,
    'media-src': ["'self'", 'data:', 'blob:'],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!dev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export function securityHeaders(opts: CspOptions): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(opts),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    // legacy fallback for browsers that ignore frame-ancestors
    'X-Frame-Options': 'DENY',
  };
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
