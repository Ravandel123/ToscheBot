import { afterEach, describe, expect, it, vi } from 'vitest';
import { amountPhrase, chancePhrase, chanceValue, percentApplied, percentPhrase, randomMagnitude } from './amount.js';

afterEach(() => vi.restoreAllMocks());

const isPowerOfTen = (value: number): boolean => Number.isInteger(Math.log10(value));

describe('randomMagnitude', () => {
   it('always returns a power of ten within [10, 10^maxZeros]', () => {
      for (let i = 0; i < 100; i++) {
         const value = randomMagnitude(8);
         expect(isPowerOfTen(value)).toBe(true);
         expect(value).toBeGreaterThanOrEqual(10);
         expect(value).toBeLessThanOrEqual(1e8);
      }
   });

   it('respects a smaller maxZeros', () => {
      for (let i = 0; i < 50; i++)
         expect([10, 100]).toContain(randomMagnitude(2));
   });

   it('stops at the first step when the stop roll always passes', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(75) → true on step 1
      expect(randomMagnitude(8)).toBe(10);
   });
});

describe('chanceValue', () => {
   it('stays within [0, 200]', () => {
      for (let i = 0; i < 200; i++) {
         const value = chanceValue();
         expect(Number.isInteger(value)).toBe(true);
         expect(value).toBeGreaterThanOrEqual(0);
         expect(value).toBeLessThanOrEqual(200);
      }
   });
});

describe('phrasings', () => {
   it('amountPhrase contains a number', () => {
      expect(amountPhrase()).toMatch(/\d/);
   });

   it('percentPhrase and chancePhrase contain a percent sign', () => {
      expect(percentPhrase()).toContain('%');
      expect(chancePhrase()).toContain('%');
   });

   it('percentApplied formats "<who> is N% <what>"', () => {
      expect(percentApplied('Tosch', 'awesome')).toMatch(/^Tosch is \d+% awesome/);
   });
});
