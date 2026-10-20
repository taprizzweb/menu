import type { TableLink } from '@/components/dash/TableLinkCard';
import type { RoomService } from '@/components/dash/RoomServiceCard';
import { TablesManager, type TableRow } from '@/components/dash/TablesManager';
import { dashContext } from '@/lib/dash/context';
import { qrDataUri, tableUrl } from '@/lib/dash/qr';
import { userClient } from '@/lib/supabase/server';

export default async function TablesPage() {
  const c = await dashContext();
  const db = await userClient();
  const { data } = await db.rpc('mgr_get_table_tokens');
  const rows = (data ?? []) as { table_id: string; label: string; active: boolean; qr_token: string }[];
  const tables: TableRow[] = await Promise.all(
    rows.map(async (r) => ({ id: r.table_id, label: r.label, active: r.active, qr: await qrDataUri(tableUrl(c.appOrigin, c.me.restaurant.slug, r.qr_token)) })),
  );
  const { data: room } = await db.rpc('mgr_get_room_service');
  const rr = (room ?? { enabled: false, token: null, rooms: [] }) as { enabled: boolean; token: string | null; rooms: string[] };
  const url = rr.enabled && rr.token ? tableUrl(c.appOrigin, c.me.restaurant.slug, rr.token) : null;
  const roomService: RoomService = { enabled: rr.enabled, url, qr: url ? await qrDataUri(url) : null, rooms: rr.rooms ?? [] };
  const { data: tl } = await db.rpc('mgr_get_table_link');
  const tr = (tl ?? { enabled: false, token: null }) as { enabled: boolean; token: string | null };
  const turl = tr.enabled && tr.token ? tableUrl(c.appOrigin, c.me.restaurant.slug, tr.token) : null;
  const tableLink: TableLink = { enabled: tr.enabled, url: turl, qr: turl ? await qrDataUri(turl) : null };
  return <TablesManager tables={tables} roomService={roomService} tableLink={tableLink} canEditLinks={c.me.role === 'owner'} />;
}
