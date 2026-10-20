'use client';
import { useId, useState } from 'react';
import { ApiFailure, openRoom } from '@/lib/guest/client';
import { errorMessageKey, t } from '@/lib/i18n';
import { normalizeRoom } from '@/lib/rooms';
import { Alert, btnPrimary } from './ui';

/** Shown on the shared room-service link: the guest says which room the order is for, then the page reloads as that room's own link. */
export function RoomPicker({ slug, token, rooms }: { slug: string; token: string; rooms: string[] | null | undefined }) {
  const id = useId();
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = rooms && rooms.length > 0 && rooms.length <= 80 ? rooms : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeRoom(room);
    if (!clean) {
      setError(t('room.invalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await openRoom(slug, token, clean);
      // A full load: the page now behaves exactly like a scan of this room's own link.
      window.location.assign(`/${slug}?k=${r.token}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiFailure ? (err.key === 'network' ? t('error.network') : t(errorMessageKey(err.key))) : t('error.server_error'));
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-lg font-extrabold">{t('room.title')}</h2>
      <p className="mt-1 text-sm text-stone-800">{t('room.body')}</p>
      <label htmlFor={id} className="mt-3 block text-sm font-semibold">{t('room.label')}</label>
      {list ? (
        <select id={id} value={room} onChange={(e) => setRoom(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base" required>
          <option value="">{t('room.choose')}</option>
          {list.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      ) : (
        <input id={id} value={room} onChange={(e) => setRoom(e.target.value)} maxLength={10} autoComplete="off" inputMode="text" placeholder={t('room.placeholder')} className="mt-1 h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base" required />
      )}
      <div className="mt-3" aria-live="polite">{error && <Alert>{error}</Alert>}</div>
      <button type="submit" disabled={busy} className={`${btnPrimary} mt-3 w-full`}>{busy ? t('room.checking') : t('room.continue')}</button>
    </form>
  );
}
