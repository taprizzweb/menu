import type { MenuData } from '@/lib/guest/types';
import type { Translator } from '@/lib/i18n';
import { mapsLink, telLink, whatsappLink } from '@/lib/profile';

type R = MenuData['restaurant'];

const icon = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;
const IPhone = () => <svg {...icon}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
const IChat = () => <svg {...icon}><path d="M4 5h16v11H9l-5 4z" /></svg>;
const IPin = () => <svg {...icon}><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
const IInsta = () => <svg {...icon}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17" cy="7" r=".6" /></svg>;
const IStar = () => <svg {...icon}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>;

const action = 'inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-100';

/** Restaurant identity at the top of the public menu: banner, logo, name, tagline and contact actions (only those the owner configured). */
export function RestaurantHero({ r, imageBase, tableLabel, t }: { r: R; imageBase: string; tableLabel?: string | null; t: Translator }) {
  return (
    <header className="mx-auto max-w-2xl">
      <div className={`relative w-full overflow-hidden bg-accent/15 sm:rounded-b-3xl ${r.banner_path ? 'h-36 sm:h-48' : 'h-16'}`}>
        {r.banner_path && (
          // eslint-disable-next-line @next/next/no-img-element -- owner uploads are already shrunk; the host is our own storage
          <img src={`${imageBase}${r.banner_path}`} alt="" width={1280} height={384} fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="px-4 pb-3">
        <div className="-mt-10 flex items-end gap-3">
          {r.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img src={`${imageBase}${r.logo_path}`} alt={t('hero.logoAlt', { name: r.name })} width={80} height={80} decoding="async" className="h-20 w-20 shrink-0 rounded-2xl border-4 border-stone-50 bg-white object-cover shadow-sm" />
          ) : (
            <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-stone-50 bg-accent text-3xl font-extrabold text-white shadow-sm">{r.name.trim().charAt(0).toUpperCase()}</span>
          )}
          {tableLabel && <p className="mb-1 inline-flex rounded-full border-2 border-accent bg-white px-3 py-0.5 text-sm font-bold text-accent">{t('app.table', { label: tableLabel })}</p>}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold leading-tight">{r.name}</h1>
        {r.tagline && <p className="mt-0.5 text-base font-medium text-stone-700">{r.tagline}</p>}
        {r.description && <p className="mt-2 text-sm leading-relaxed text-stone-800">{r.description}</p>}
        {(r.address || r.hours_text) && (
          <dl className="mt-2 space-y-0.5 text-sm text-stone-800">
            {r.address && <div><dt className="sr-only">Address</dt><dd>{r.address}</dd></div>}
            {r.hours_text && <div><dt className="inline font-semibold">{t('hero.hours')}: </dt><dd className="inline">{r.hours_text}</dd></div>}
          </dl>
        )}
        {(r.phone || r.whatsapp || r.address || r.instagram_url || r.review_url) && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {r.phone && <li><a className={action} href={telLink(r.phone)}><IPhone />{t('hero.call')}</a></li>}
            {r.whatsapp && <li><a className={action} href={whatsappLink(r.whatsapp, t('hero.whatsappMessage', { name: r.name }))} target="_blank" rel="noopener noreferrer"><IChat />{t('hero.whatsapp')}</a></li>}
            {r.address && <li><a className={action} href={mapsLink(r.name, r.address)} target="_blank" rel="noopener noreferrer"><IPin />{t('hero.directions')}</a></li>}
            {r.instagram_url && <li><a className={action} href={r.instagram_url} target="_blank" rel="noopener noreferrer"><IInsta />{t('hero.instagram')}</a></li>}
            {r.review_url && <li><a className={action} href={r.review_url} target="_blank" rel="noopener noreferrer" aria-describedby="review-note"><IStar />{t('hero.review')}</a></li>}
          </ul>
        )}
        {r.review_url && <p id="review-note" className="mt-1 text-xs text-stone-700">{t('hero.reviewNote')}</p>}
      </div>
    </header>
  );
}
