import { POWERED_BY, instagramUrl } from '@/lib/brand';

/** "Powered by Taprizz" with the platform's Instagram, at the bottom of the public menu. */
export function PoweredBy() {
  const url = instagramUrl(POWERED_BY.instagram);
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-6 pt-8 text-center text-sm text-stone-700">
      <p>
        Powered by <span className="font-bold text-stone-900">{POWERED_BY.name}</span>
        {url && (
          <>
            {' · '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-stone-900 underline underline-offset-2">
              @{POWERED_BY.instagram.replace(/^@/, '')}
            </a>
          </>
        )}
      </p>
    </footer>
  );
}
