import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StaffApp, type StaffMe } from '@/components/staff/StaffApp';
import { publicEnv } from '@/env';
import { aalFromToken, mfaUrl } from '@/lib/auth/aal';
import { userClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Staff',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'GoToMenu', statusBarStyle: 'black-translucent' },
};

export default async function StaffPage() {
  const db = await userClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login?next=/staff');
  const { data: me } = await db.rpc('staff_me');
  if (!me) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-extrabold">No access</h1>
        <p className="mt-3 text-stone-700">This account is not an active staff member of any restaurant. Please ask your manager.</p>
      </main>
    );
  }
  // Owners and managers need the second factor; waiters and kitchen staff do not.
  if ((me as StaffMe).role === 'owner' || (me as StaffMe).role === 'manager') {
    const { data: sess } = await db.auth.getSession();
    if (aalFromToken(sess.session?.access_token) !== 'aal2') redirect(mfaUrl('/staff'));
  }
  const env = publicEnv();
  return <StaffApp me={me as StaffMe} supabase={{ url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }} />;
}
