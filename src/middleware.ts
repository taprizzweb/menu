import { NextResponse, type NextRequest } from 'next/server';
import { newNonce, securityHeaders } from '@/lib/security/csp';

// Edge-safe: only reads NEXT_PUBLIC_* values (inlined at build time). The full env check runs at boot
// in instrumentation.ts.
export function middleware(request: NextRequest) {
  const nonce = newNonce();
  const requestId = crypto.randomUUID();
  const headers = securityHeaders({
    nonce,
    dev: process.env.NODE_ENV !== 'production',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.supabase.co',
  });

  // Next.js reads the nonce from the request's CSP header and stamps it on its own <script> tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy']!);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
};
