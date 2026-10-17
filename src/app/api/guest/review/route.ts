import { NextResponse } from 'next/server';
import { guestRoute } from '@/lib/api/route';
import { ApiError } from '@/lib/errors';
import { limit, rpc } from '@/lib/guest/rpc';
import { guestSessionFrom } from '@/lib/guest/session-cookie';

export const dynamic = 'force-dynamic';

// "Rate us on Google": records the tap, then redirects to the restaurant's review link.
export async function GET(req: Request) {
  return guestRoute(req, { method: 'GET' }, async () => {
    const session = guestSessionFrom(req.headers);
    if (!session) throw new ApiError(401, 'unauthorized');
    await limit(`rv:${session.sessionId}`, 20, 3600);
    const url = await rpc<string>('guest_record_review_click', { p_session_id: session.sessionId });
    // The database only stores https links, but check again before redirecting anywhere.
    if (!/^https:\/\//.test(url)) throw new ApiError(404, 'not_found');
    return NextResponse.redirect(url, 302);
  });
}
