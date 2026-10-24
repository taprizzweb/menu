import type { MenuCategory, MenuItem } from './types';

export type Filter = 'veg' | 'nonveg' | 'jain' | 'bar' | 'bestseller';
export const FILTERS: readonly Filter[] = ['veg', 'nonveg', 'jain', 'bar', 'bestseller'];

/** Categories such as "Bar - Wine - Red" hold drinks: they carry no veg / non-veg mark. */
export const isBarCategory = (name: string): boolean => /^bar\s*-/i.test(name.trim());

/** Flags every dish of a "Bar -" category so cards, search results and the cart can tell them apart. */
export const flagBarItems = (categories: MenuCategory[]): MenuCategory[] =>
  categories.map((c) => (isBarCategory(c.name_en) ? { ...c, items: c.items.map((i) => ({ ...i, bar: true })) } : c));

/** Veg and Non-Veg exclude each other; switching one on switches the other off. */
export function toggleFilter(cur: ReadonlySet<Filter>, f: Filter): Set<Filter> {
  const n = new Set(cur);
  if (n.has(f)) {
    n.delete(f);
    return n;
  }
  n.add(f);
  if (f === 'veg') n.delete('nonveg');
  if (f === 'nonveg') n.delete('veg');
  return n;
}

/**
 * A dish must match every chip that is on. Drinks have no diet: Veg / Non-Veg skip them, unless Bar is on too,
 * so "Bar + Veg" still lists the bar and "Veg" alone never lists wine.
 */
export function matchesFilters(item: MenuItem, filters: ReadonlySet<Filter>): boolean {
  const bar = !!item.bar;
  if (filters.has('bar') && !bar) return false;
  const dietFilter = filters.has('veg') || filters.has('nonveg');
  if (dietFilter && bar && !filters.has('bar')) return false;
  if (!bar) {
    if (filters.has('veg') && item.diet !== 'veg' && item.diet !== 'jain') return false;
    if (filters.has('nonveg') && item.diet !== 'nonveg') return false;
    if (filters.has('jain') && item.diet !== 'jain') return false;
  } else if (filters.has('jain')) return false;
  if (filters.has('bestseller') && !item.is_bestseller) return false;
  return true;
}
