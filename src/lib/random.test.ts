import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomInt, randomItem, chance, weightedItem } from './random.js';

afterEach(() => {
   vi.restoreAllMocks();
});

function mockRandom(value: number): void {
   vi.spyOn(Math, 'random').mockReturnValue(value);
}

describe('randomInt', () => {
   it('returns min when Math.random is 0', () => {
      mockRandom(0);
      expect(randomInt(3, 7)).toBe(3);
   });

   it('returns max when Math.random is near 1', () => {
      mockRandom(0.999999);
      expect(randomInt(3, 7)).toBe(7);
   });

   it('stays within bounds across many real rolls', () => {
      for (let i = 0; i < 1000; i++) {
         const n = randomInt(1, 6);
         expect(n).toBeGreaterThanOrEqual(1);
         expect(n).toBeLessThanOrEqual(6);
      }
   });
});

describe('randomItem', () => {
   it('throws on an empty array', () => {
      expect(() => randomItem([])).toThrow();
   });

   it('returns the only element of a singleton', () => {
      expect(randomItem(['x'])).toBe('x');
   });
});

describe('chance', () => {
   it('is always false at 0 and always true at 100', () => {
      mockRandom(0);
      expect(chance(0)).toBe(false);
      expect(chance(100)).toBe(true);
   });
});

describe('weightedItem', () => {
   it('picks the entry whose cumulative weight covers the roll', () => {
      // total weight 10; roll = 0.85 * 10 = 8.5 → lands in the third bucket.
      mockRandom(0.85);
      const picked = weightedItem([['a', 2], ['b', 3], ['c', 5]]);
      expect(picked).toBe('c');
   });

   it('picks the first entry when the roll is 0', () => {
      mockRandom(0);
      expect(weightedItem([['a', 1], ['b', 1]])).toBe('a');
   });
});
