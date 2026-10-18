import { PrintButton } from '@/components/dash/PrintButton';
import { dashContext } from '@/lib/dash/context';
import { qrDataUri, tableUrl } from '@/lib/dash/qr';
import { userClient } from '@/lib/supabase/server';

export const metadata = { title: 'Print QR codes' };

export default async function PrintPage({ searchParams }: { searchParams: Promise<{ layout?: string; t?: string }> }) {
  const { layout, t } = await searchParams;
  const tent = layout === 'tent';
  const c = await dashContext();
  const db = await userClient();
  const { data } = await db.rpc('mgr_get_table_tokens');
  const rows = ((data ?? []) as { table_id: string; label: string; active: boolean; qr_token: string }[]).filter((r) => r.active && (!t || r.table_id === t));
  const cards = await Promise.all(rows.map(async (r) => ({ id: r.table_id, label: r.label, qr: await qrDataUri(tableUrl(c.appOrigin, c.me.restaurant.slug, r.qr_token)) })));
  const name = c.me.restaurant.name;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="mr-auto text-2xl font-extrabold">{tent ? 'Table tents' : 'QR sheet'}</h1>
        <PrintButton />
      </div>
      {cards.length === 0 && <p className="print:hidden">There are no active tables to print. Create tables first.</p>}
      {tent ? (
        <div>
          {cards.map((k) => (
            <div key={k.id} className="print-tent flex border border-stone-300 print:border-0">
              {[false, true].map((flip) => (
                <div key={String(flip)} aria-hidden={flip} className={`flex w-1/2 flex-col items-center justify-center gap-3 p-6 text-center ${flip ? 'rotate-180' : ''}`}>
                  <p className="text-2xl font-extrabold">{name}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={k.qr} alt={flip ? '' : `QR code for table ${k.label}`} width={260} height={260} className="h-64 w-64" />
                  <p className="text-3xl font-extrabold">Scan to order</p>
                  <p className="text-xl font-bold">Table {k.label}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="print-sheet grid grid-cols-2 gap-4 print:gap-0">
          {cards.map((k) => (
            <div key={k.id} className="print-card flex flex-col items-center justify-center gap-2 border border-dashed border-stone-400 p-4 text-center">
              <p className="text-xl font-extrabold">{name}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={k.qr} alt={`QR code for table ${k.label}`} width={200} height={200} className="h-48 w-48" />
              <p className="text-2xl font-extrabold">Scan to order</p>
              <p className="text-lg font-bold">Table {k.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
