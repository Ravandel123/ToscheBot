import { describe, expect, it } from 'vitest';
import { resolveDDCategory, darkestDungeonQuote, DD_QUOTES } from './darkestDungeon.js';

describe('resolveDDCategory', () => {
   it('accepts category names', () => {
      expect(resolveDDCategory('virtue')).toBe('virtue');
      expect(resolveDDCategory('VICTORY')).toBe('victory');
   });

   it('accepts legacy numbers 1–7', () => {
      expect(resolveDDCategory('1')).toBe('affliction');
      expect(resolveDDCategory('7')).toBe('victory');
   });

   it('returns undefined for nothing or garbage', () => {
      expect(resolveDDCategory(undefined)).toBeUndefined();
      expect(resolveDDCategory('nonsense')).toBeUndefined();
   });
});

describe('darkestDungeonQuote', () => {
   it('picks from the requested category', () => {
      expect(DD_QUOTES.virtue).toContain(darkestDungeonQuote('virtue'));
   });

   it('picks from all categories by default', () => {
      const all = Object.values(DD_QUOTES).flat();
      expect(all).toContain(darkestDungeonQuote());
   });
});
