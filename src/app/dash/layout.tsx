import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashNav } from '@/components/dash/DashNav';
import type { StaffMe } from '@/components/staff/StaffApp';
import { aalFromToken, mfaUrl } from '@/lib/auth/aal';
import { userClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const db = await userClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login?next=/dash/menu');
  const { data: me } = await db.rpc('staff_me');
  const m = me as StaffMe | null;
  if (!m) redirect('/staff');
  // Waiters and kitchen staff only use the live screen.
  if (m.role !== 'owner' && m.role !== 'manager') redirect('/staff');
  const { data: sess } = await db.auth.getSession();
  if (aalFromToken(sess.session?.access_token) !== 'aal2') redirect(mfaUrl('/dash/menu'));
  return (
    <div data-accent={m.restaurant.accent} className="min-h-dvh bg-stone-50">
      <DashNav name={m.restaurant.name} role={m.role} slug={m.restaurant.slug} />
      {m.restaurant.status !== 'active' && (
        <p role="status" className="bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-900">This restaurant is paused, so changes are switched off. Please contact support.</p>
      )}
      <div id="dash-main" className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 print:max-w-none print:p-0" data-role={m.role}>{children}</div>
    </div>
  );
}
