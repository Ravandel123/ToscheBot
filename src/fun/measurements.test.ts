import { afterEach, describe, expect, it, vi } from 'vitest';
import {
   measuredQuantity, measurePhrase, sizePhrase, whenPhrase, wherePhrase,
   WEIGHT_UNITS, SIZES_BIG, SIZES_SMALL, SIZES_AVERAGE,
} from './measurements.js';

afterEach(() => vi.restoreAllMocks());

describe('measuredQuantity', () => {
   it('ends with one of the given units', () => {
      const out = measuredQuantity(WEIGHT_UNITS);
      expect(WEIGHT_UNITS.some((u) => out.endsWith(u))).toBe(true);
   });
});

describe('measurePhrase', () => {
   it('returns a special line when the chance roll fires', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(15) → true
      expect(measurePhrase(WEIGHT_UNITS, ['ONLY SPECIAL'])).toBe('ONLY SPECIAL');
   });

   it('otherwise states a quantity with a unit', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // chance(15) → false
      expect(WEIGHT_UNITS.some((u) => measurePhrase(WEIGHT_UNITS, ['x']).includes(u))).toBe(true);
   });
});

describe('sizePhrase', () => {
   it('uses a known size adjective on the normal path', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // skip the 15% special
      const all = [...SIZES_BIG, ...SIZES_SMALL, ...SIZES_AVERAGE];
      const out = sizePhrase().toLowerCase();
      expect(all.some((s) => out.includes(s))).toBe(true);
   });
});

describe('whenPhrase / wherePhrase', () => {
   it('always returns a non-empty string', () => {
      expect(whenPhrase().length).toBeGreaterThan(0);
      expect(wherePhrase().length).toBeGreaterThan(0);
   });
});
