/**
 * CSRF defence for state-changing routes: the request must come from our own site.
 * Browsers always send Origin on cross-site and same-site POSTs; if it is missing we fall back to Referer,
 * and refuse when neither proves the request came from us.
 */
export function isAllowedOrigin(headers: Headers, appOrigin: string): boolean {
  const allowed = new URL(appOrigin).origin;
  const origin = headers.get('origin');
  if (origin) return origin === allowed;
  const referer = headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === allowed;
    } catch {
      return false;
    }
  }
  return false;
}

export function isJson(headers: Headers): boolean {
  const ct = headers.get('content-type') ?? '';
  return /^application\/json\s*(;|$)/i.test(ct);
}

export const MAX_BODY_BYTES = 16 * 1024;
