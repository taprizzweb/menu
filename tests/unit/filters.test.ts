import { describe, expect, it } from 'vitest';
import { flagBarItems, isBarCategory, matchesFilters, toggleFilter, type Filter } from '@/lib/guest/filters';
import type { MenuCategory, MenuItem } from '@/lib/guest/types';

const item = (o: Partial<MenuItem>): MenuItem => ({ id: 'i', name_en: 'X', description_en: null, price_paise: 100, diet: 'veg', spice: 0, image_path: null, is_available: true, is_bestseller: false, is_chef_pick: false, ...o });
const on = (...f: Filter[]) => new Set<Filter>(f);

describe('menu filters', () => {
  it('recognises Bar categories by their name', () => {
    expect(isBarCategory('Bar - Wine - Red')).toBe(true);
    expect(isBarCategory('bar - Beer')).toBe(true);
    expect(isBarCategory('Starters - Veg')).toBe(false);
    expect(isBarCategory('Barbecue')).toBe(false);
  });

  it('flags only the dishes of Bar categories', () => {
    const cats = [
      { id: 'a', name_en: 'Bar - Beer', items: [item({ id: '1' })] },
      { id: 'b', name_en: 'Soup - Non-Veg', items: [item({ id: '2', diet: 'nonveg' })] },
    ] as MenuCategory[];
    const out = flagBarItems(cats);
    expect(out[0]!.items[0]!.bar).toBe(true);
    expect(out[1]!.items[0]!.bar).toBeUndefined();
  });

  it('Veg and Non-Veg switch each other off', () => {
    expect([...toggleFilter(on('veg', 'bestseller'), 'nonveg')].sort()).toEqual(['bestseller', 'nonveg']);
    expect([...toggleFilter(on('nonveg'), 'veg')]).toEqual(['veg']);
    expect([...toggleFilter(on('veg'), 'veg')]).toEqual([]);
  });

  it('matches by diet; Jain counts as vegetarian', () => {
    expect(matchesFilters(item({ diet: 'veg' }), on('veg'))).toBe(true);
    expect(matchesFilters(item({ diet: 'jain' }), on('veg'))).toBe(true);
    expect(matchesFilters(item({ diet: 'nonveg' }), on('veg'))).toBe(false);
    expect(matchesFilters(item({ diet: 'nonveg' }), on('nonveg'))).toBe(true);
    expect(matchesFilters(item({ diet: 'veg' }), on('nonveg'))).toBe(false);
    expect(matchesFilters(item({ diet: 'veg' }), on('jain'))).toBe(false);
  });

  it('needs every chip that is on (AND)', () => {
    expect(matchesFilters(item({ is_bestseller: true }), on('veg', 'bestseller'))).toBe(true);
    expect(matchesFilters(item({ is_bestseller: false }), on('veg', 'bestseller'))).toBe(false);
    expect(matchesFilters(item({ diet: 'nonveg', is_bestseller: true }), on('veg', 'bestseller'))).toBe(false);
  });

  it('Bar shows only drinks; Veg / Non-Veg never list drinks unless Bar is on', () => {
    const wine = item({ bar: true });
    expect(matchesFilters(wine, on('bar'))).toBe(true);
    expect(matchesFilters(item({}), on('bar'))).toBe(false);
    expect(matchesFilters(wine, on('veg'))).toBe(false);
    expect(matchesFilters(wine, on('nonveg'))).toBe(false);
    expect(matchesFilters(wine, on('bar', 'veg'))).toBe(true);
    expect(matchesFilters(wine, on('bar', 'nonveg'))).toBe(true);
    expect(matchesFilters(wine, on('bar', 'bestseller'))).toBe(false);
  });
});
