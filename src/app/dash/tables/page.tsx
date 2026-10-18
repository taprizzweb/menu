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
  return <TablesManager tables={tables} />;
}
