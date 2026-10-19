import type { MenuData } from '@/lib/guest/types';
import type { TrackIds } from '@/lib/guest/analytics';
import type { Translator } from '@/lib/i18n';
import type { MenuEvent } from '@/lib/schemas/guest';
import { mapsLink, telLink, whatsappLink } from '@/lib/profile';

type R = MenuData['restaurant'];

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;
const IPhone = () => <svg {...icon}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
const IChat = () => <svg {...icon}><path d="M4 5h16v11H9l-5 4z" /></svg>;
const IPin = () => <svg {...icon}><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
const IInsta = () => <svg {...icon}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17" cy="7" r=".6" /></svg>;
const IStar = () => <svg {...icon}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>;

/**
 * Top of the public menu: a full-width cover photo (or the restaurant colour when there is none) with the name,
 * tagline and an "Explore the menu" button. Contact details live further down in <RestaurantInfo>, not here.
 * `compact` is the slim version used on the order-status screens.
 */
export function RestaurantHero({ r, imageBase, tableLabel, t, compact = false }: { r: R; imageBase: string; tableLabel?: string | null; t: Translator; compact?: boolean }) {
  return (
    <header className={`relative isolate overflow-hidden bg-accent text-white ${compact ? 'h-32' : 'h-[19rem] sm:h-[24rem]'}`}>
      {r.banner_path && (
        // eslint-disable-next-line @next/next/no-img-element -- owner uploads are already shrunk; the host is our own storage
        <img src={`${imageBase}${r.banner_path}`} alt="" width={1280} height={768} fetchPriority="high" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      )}
      {/* scrim so white text stays readable on any photo */}
      <div aria-hidden className={`absolute inset-0 -z-10 ${r.banner_path ? 'bg-gradient-to-t from-black/75 via-black/30 to-black/10' : 'bg-black/15'}`} />
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-between px-5 pb-6 pt-5">
        <div className="flex items-center justify-between gap-3">
          {r.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img src={`${imageBase}${r.logo_path}`} alt={t('hero.logoAlt', { name: r.name })} width={56} height={56} decoding="async" className="h-14 w-14 rounded-2xl bg-white object-cover shadow-md ring-1 ring-white/60" />
          ) : (
            <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white font-serif text-2xl font-bold text-accent shadow-md">{r.name.trim().charAt(0).toUpperCase()}</span>
          )}
          {tableLabel && <p className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-stone-900 shadow-md">{t('app.table', { label: tableLabel })}</p>}
        </div>
        <div>
          <h1 className={`font-serif font-bold leading-[1.05] tracking-tight ${compact ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}>{r.name}</h1>
          {r.tagline && !compact && <p className="mt-2 max-w-md text-base text-white">{r.tagline}</p>}
          {!compact && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
              <a href="#menu" className="inline-flex min-h-12 items-center rounded-xl bg-white px-6 text-base font-bold text-stone-900 shadow-lg hover:bg-stone-100">{t('hero.explore')}</a>
              <a href="#info" className="inline-flex min-h-11 items-center text-sm font-semibold text-white underline underline-offset-4">{t('hero.info')}</a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const tile = 'flex min-h-14 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-50';

/** "Find us": about text, address, hours and the contact actions the owner configured, kept out of the way of the menu. */
export function RestaurantInfo({ r, t, onTrack }: { r: R; t: Translator; onTrack?: (e: MenuEvent, ids?: TrackIds) => void }) {
  const hasActions = r.phone || r.whatsapp || r.address || r.instagram_url || r.review_url;
  if (!r.description && !r.address && !r.hours_text && !hasActions) return null;
  return (
    <section id="info" aria-labelledby="info-h" className="mx-auto mt-12 max-w-5xl scroll-mt-4 px-4">
      <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-8">
        <h2 id="info-h" className="font-serif text-2xl font-bold">{t('info.title')}</h2>
        {r.description && <p className="mt-2 max-w-prose text-sm leading-relaxed text-stone-800">{r.description}</p>}
        {(r.address || r.hours_text) && (
          <dl className="mt-3 space-y-1 text-sm text-stone-800">
            {r.address && <div><dt className="sr-only">Address</dt><dd>{r.address}</dd></div>}
            {r.hours_text && <div><dt className="inline font-semibold">{t('hero.hours')}: </dt><dd className="inline">{r.hours_text}</dd></div>}
          </dl>
        )}
        {hasActions && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {r.phone && <li><a className={tile} href={telLink(r.phone)} onClick={() => onTrack?.('call_click')}><IPhone />{t('hero.call')}</a></li>}
            {r.whatsapp && <li><a className={tile} href={whatsappLink(r.whatsapp, t('hero.whatsappMessage', { name: r.name }))} target="_blank" rel="noopener noreferrer" onClick={() => onTrack?.('whatsapp_click')}><IChat />{t('hero.whatsapp')}</a></li>}
            {r.address && <li><a className={tile} href={mapsLink(r.name, r.address)} target="_blank" rel="noopener noreferrer" onClick={() => onTrack?.('directions_click')}><IPin />{t('hero.directions')}</a></li>}
            {r.instagram_url && <li><a className={tile} href={r.instagram_url} target="_blank" rel="noopener noreferrer" onClick={() => onTrack?.('instagram_click')}><IInsta />{t('hero.instagram')}</a></li>}
            {r.review_url && <li><a className={tile} href={r.review_url} target="_blank" rel="noopener noreferrer" aria-describedby="review-note" onClick={() => onTrack?.('google_review_click')}><IStar />{t('hero.review')}</a></li>}
          </ul>
        )}
        {r.review_url && <p id="review-note" className="mt-2 text-xs text-stone-700">{t('hero.reviewNote')}</p>}
      </div>
    </section>
  );
}
