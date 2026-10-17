'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { formatPaise } from '@/lib/money';
import type { MenuCategory, MenuItem } from '@/lib/guest/types';
import type { Lang, Translator } from '@/lib/i18n';
import { DietMark, IconMinus, IconPlus, IconSearch, SpiceDots } from './ui';

type Filter = 'veg' | 'jain' | 'bestseller';

const pick = (lang: Lang, en: string | null, hi: string | null) => (lang === 'hi' && hi ? hi : (en ?? ''));

const ItemCard = memo(function ItemCard({
  item, lang, t, qty, canOrder, imageBase, onAdd, onSet,
}: {
  item: MenuItem; lang: Lang; t: Translator; qty: number; canOrder: boolean; imageBase: string;
  onAdd: (id: string) => void; onSet: (id: string, qty: number) => void;
}) {
  const name = pick(lang, item.name_en, item.name_hi);
  const desc = pick(lang, item.description_en, item.description_hi);
  const soldOut = !item.is_available;
  return (
    <li className={`flex gap-3 rounded-2xl border p-3 ${soldOut ? 'border-stone-200 bg-stone-100' : 'border-stone-200 bg-white'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <DietMark diet={item.diet} t={t} />
          {item.is_bestseller && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">{t('badge.bestseller')}</span>}
          {item.is_chef_pick && <span className="rounded-md bg-stone-900 px-1.5 py-0.5 text-xs font-bold text-white">{t('badge.chefPick')}</span>}
        </div>
        <h3 className={`mt-1 text-base font-semibold leading-snug ${soldOut ? 'text-stone-700' : ''}`}>{name}</h3>
        {desc && <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{desc}</p>}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-base font-bold">{formatPaise(item.price_paise)}</span>
          <SpiceDots level={item.spice} t={t} />
        </div>
      </div>
      <div className="flex w-28 shrink-0 flex-col items-center justify-between gap-2">
        {item.image_path && (
          // Fixed square box => no layout shift while the image loads. Menu photos are already compressed on upload.
          <div className="aspect-square w-full overflow-hidden rounded-xl bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${imageBase}${item.image_path}`} alt="" width={112} height={112} loading="lazy" decoding="async" className={`h-full w-full object-cover ${soldOut ? 'grayscale' : ''}`} />
          </div>
        )}
        {soldOut ? (
          <span className="flex min-h-11 items-center text-sm font-bold text-stone-600">{t('item.soldOut')}</span>
        ) : canOrder ? (
          qty === 0 ? (
            <button type="button" onClick={() => onAdd(item.id)} aria-label={t('item.addNamed', { name })} className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border-2 border-accent bg-white text-sm font-bold text-accent">
              <IconPlus /> {t('item.add')}
            </button>
          ) : (
            <div className="flex w-full items-center justify-between rounded-xl bg-accent text-white">
              <button type="button" onClick={() => onSet(item.id, qty - 1)} aria-label={t('item.decrease', { name })} className="flex h-11 w-11 items-center justify-center">
                <IconMinus />
              </button>
              <span className="min-w-6 text-center text-base font-bold" aria-live="polite">{qty}</span>
              <button type="button" onClick={() => onSet(item.id, qty + 1)} aria-label={t('item.increase', { name })} className="flex h-11 w-11 items-center justify-center disabled:opacity-50" disabled={qty >= 10}>
                <IconPlus />
              </button>
            </div>
          )
        ) : null}
      </div>
    </li>
  );
});

export function MenuView({
  categories, lang, t, canOrder, imageBase, qtyOf, onAdd, onSet,
}: {
  categories: MenuCategory[]; lang: Lang; t: Translator; canOrder: boolean; imageBase: string;
  qtyOf: (id: string) => number; onAdd: (id: string) => void; onSet: (id: string, qty: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => {
          if (filters.has('veg') && i.diet !== 'veg' && i.diet !== 'jain') return false;
          if (filters.has('jain') && i.diet !== 'jain') return false;
          if (filters.has('bestseller') && !i.is_bestseller) return false;
          if (!q) return true;
          return [i.name_en, i.name_hi, i.description_en, i.description_hi].some((s) => s?.toLowerCase().includes(q));
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, filters]);

  // Highlight the category currently under the sticky bar.
  useEffect(() => {
    const els = shown.map((c) => document.getElementById(`cat-${c.id}`)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace('cat-', ''));
      },
      { rootMargin: '-72px 0px -65% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [shown]);

  // Keep the active chip visible in the horizontal bar.
  useEffect(() => {
    if (!active) return;
    barRef.current?.querySelector<HTMLElement>(`[data-cat='${active}']`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active]);

  const toggle = (f: Filter) =>
    setFilters((cur) => {
      const n = new Set(cur);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  const jump = (id: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const chip = (on: boolean) => `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${on ? 'border-accent bg-accent text-white' : 'border-stone-300 bg-white text-stone-800'}`;

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pb-3">
        <label className="relative block">
          <span className="sr-only">{t('menu.search')}</span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('menu.searchPlaceholder')}
            className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3 text-base"
            maxLength={60}
            enterKeyHint="search"
            autoComplete="off"
          />
        </label>
        <div role="group" aria-label={t('menu.filters')} className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {(['veg', 'jain', 'bestseller'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filters.has(f)} onClick={() => toggle(f)} className={chip(filters.has(f))}>
              {t(`menu.filter.${f}` as 'menu.filter.veg')}
            </button>
          ))}
        </div>
      </div>

      {/* Only this single row sticks while scrolling. */}
      <div className="sticky top-0 z-20 border-y border-stone-200 bg-stone-50 px-4 py-2">
        <nav aria-label={t('menu.categories')} ref={barRef} className="no-scrollbar mx-auto flex max-w-2xl gap-2 overflow-x-auto">
          {shown.map((c) => (
            <button key={c.id} type="button" data-cat={c.id} onClick={() => jump(c.id)} aria-current={active === c.id ? 'true' : undefined} className={chip(active === c.id)}>
              {pick(lang, c.name_en, c.name_hi)}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {categories.length === 0 ? (
          <p className="py-16 text-center text-stone-600">{t('menu.empty')}</p>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-stone-600">{t('menu.noResults')}</p>
            <button type="button" onClick={() => { setQuery(''); setFilters(new Set()); }} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold">
              {t('menu.clearFilters')}
            </button>
          </div>
        ) : (
          shown.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`cat-h-${c.id}`} className="scroll-mt-16 pt-4">
              <h2 id={`cat-h-${c.id}`} className="mb-2 text-lg font-bold">{pick(lang, c.name_en, c.name_hi)}</h2>
              <ul className="space-y-3">
                {c.items.map((i) => (
                  <ItemCard key={i.id} item={i} lang={lang} t={t} qty={qtyOf(i.id)} canOrder={canOrder} imageBase={imageBase} onAdd={onAdd} onSet={onSet} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}
