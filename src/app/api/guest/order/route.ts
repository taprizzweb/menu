import { NextResponse } from 'next/server';
import { guestRoute, jsonOk } from '@/lib/api/route';
import { limit, rpc } from '@/lib/guest/rpc';
import { setGuestCookie } from '@/lib/guest/session-cookie';
import { orderBody } from '@/lib/schemas/guest';

export const dynamic = 'force-dynamic';

interface PlaceResult {
  order_no: number;
  total_paise: number;
  session_id: string;
  status: string;
  replayed: boolean;
}

export async function POST(req: Request) {
  return guestRoute(req, { method: 'POST', schema: orderBody }, async (ctx, body) => {
    // Failed attempts (e.g. token guessing) are counted here: a failing database call rolls back its own counter.
    await limit(`ipf:${ctx.ipHash}`, 40, 600);
    const r = await rpc<PlaceResult>('guest_place_order', {
      p_slug: body.slug,
      p_token: body.token,
      p_items: body.items.map((i) => ({ item_id: i.item_id, qty: i.qty, note: i.note || null })),
      p_note: body.note || null,
      p_idem: body.idempotency_key,
      p_ip_hash: ctx.ipHash,
    });
    const res = jsonOk({ order_no: r.order_no, total_paise: r.total_paise, status: r.status, replayed: r.replayed }, ctx.requestId) as NextResponse;
    setGuestCookie(res, r.session_id, body.slug);
    return res;
  });
}
