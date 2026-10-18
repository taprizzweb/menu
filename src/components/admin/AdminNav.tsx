'use client';
import { useState } from 'react';
import { apiPostLogout } from '@/components/dash/logout';

export function AdminNav() {
  const [busy, setBusy] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <p className="mr-auto text-base font-extrabold">GoToMenu <span className="font-semibold text-stone-700">Platform admin</span></p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await apiPostLogout();
            window.location.assign('/login');
          }}
          className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-3 text-sm font-semibold"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
