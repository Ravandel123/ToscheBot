import { describe, expect, it } from 'vitest';
import {
   FORAGABLES,
   FORAGABLE_ITEMS,
   FORAGABLE_ITEM_IDS,
   FORAGE_DESCRIPTORS,
   FORAGE_FAMILIES,
   forageDescriptor,
   foragableInfo,
   isForagableId,
   type ForagableItemId,
} from './foragables.js';
import { ITEMS } from './items.js';

// Content-integrity checks (like the location/encounter catalogs): a typo'd
// descriptor id or a family with no impostor would break identification —
// silently, mid-game — so fail `npm test` instead.

describe('FORAGABLE_ITEMS catalog', () => {
   it('is spread into the main ITEMS catalog as material kind', () => {
      for (const id of FORAGABLE_ITEM_IDS) {
         expect(id in ITEMS, `${id} missing from ITEMS`).toBe(true);
         expect(ITEMS[id].kind, `${id} must be a material`).toBe('material');
      }
   });

   it('keeps FORAGABLES and FORAGABLE_ITEMS keyed identically', () => {
      expect(Object.keys(FORAGABLES).sort()).toEqual(Object.keys(FORAGABLE_ITEMS).sort());
   });

   it('carries positive weights and values', () => {
      for (const id of FORAGABLE_ITEM_IDS) {
         expect(FORAGABLE_ITEMS[id].weightKg, `${id} weight`).toBeGreaterThan(0);
         expect(FORAGABLE_ITEMS[id].value, `${id} value`).toBeGreaterThanOrEqual(0);
      }
   });
});

describe('FORAGABLES profession layer', () => {
   it('every look belongs to the item\'s own family (mislabels stay plausible)', () => {
      for (const id of FORAGABLE_ITEM_IDS) {
         const info = FORAGABLES[id];
         for (const look of info.looks)
            expect(FORAGE_DESCRIPTORS[look].family, `${id} look '${look}' crosses families`).toBe(info.family);
      }
   });

   it('every family with a member has at least two (an impostor always exists)', () => {
      const byFamily = new Map<string, ForagableItemId[]>();
      for (const id of FORAGABLE_ITEM_IDS) {
         const family = FORAGABLES[id].family;
         byFamily.set(family, [...byFamily.get(family) ?? [], id]);
      }

      for (const [family, members] of byFamily)
         expect(members.length, `family '${family}' has no lookalike to mislabel as`).toBeGreaterThanOrEqual(2);
   });

   it('descriptor texts are lowercase noun phrases with articles', () => {
      for (const [id, descriptor] of Object.entries(FORAGE_DESCRIPTORS)) {
         expect(descriptor.text.length, `${id} text`).toBeGreaterThan(0);
         expect(descriptor.text[0], `${id} should start lowercase (display capitalizes)`).toBe(descriptor.text[0].toLowerCase());
         expect(descriptor.family in FORAGE_FAMILIES, `${id} family`).toBe(true);
      }
   });

   it('resolves ids tolerantly (D10 rule 3)', () => {
      expect(isForagableId('silverleaf')).toBe(true);
      expect(isForagableId('iron_sword')).toBe(false);
      expect(foragableInfo('no_such_plant')).toBeNull();
      expect(forageDescriptor('no_such_look')).toBeNull();
   });
});
