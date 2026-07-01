import { afterEach, describe, expect, it, vi } from 'vitest';
import { createName, generateName, parseGender, randomGender, totalNameCount } from './names.js';

afterEach(() => vi.restoreAllMocks());

// Math.random → 0 makes every pick land on the first element (randomItem index 0,
// randomInt → its minimum), so output is fully deterministic.
function pickFirst(): void {
   vi.spyOn(Math, 'random').mockReturnValue(0);
}

describe('generateName', () => {
   it('assembles the first fragment of each slot and capitalizes the result', () => {
      pickFirst();
      expect(generateName('male', 1)).toBe('Ash'); // shape-1 slot: ['Ash', ...]
      expect(generateName('male', 2)).toBe('Aah'); // 'A' + 'ah'
      expect(generateName('female', 1)).toBe('Ash');
   });

   it('always returns a capitalized name', () => {
      for (let i = 0; i < 20; i++)
         expect(generateName('female', 3)).toMatch(/^[A-Z]/);
   });
});

describe('createName', () => {
   it('forces the syllable into the given 1-based position', () => {
      pickFirst();
      expect(createName('ric', 'male', 2, 2)).toBe('Aric'); // 'A' + 'ric'
      expect(createName('mid', 'male', 2, 3)).toBe('Amidaki'); // 'A' + 'mid' + 'aki'
   });

   it('normalizes the syllable casing (no stray mid-name capital)', () => {
      pickFirst();
      expect(createName('Vex', 'male', 1, 2)).toBe('Vexah'); // capital only at the front
   });
});

describe('parseGender', () => {
   it('resolves aliases case-insensitively', () => {
      expect(parseGender('m')).toBe('male');
      expect(parseGender('MALE')).toBe('male');
      expect(parseGender('man')).toBe('male');
      expect(parseGender('f')).toBe('female');
      expect(parseGender('woman')).toBe('female');
   });

   it('returns undefined for an unknown gender', () => {
      expect(parseGender('attack helicopter')).toBeUndefined();
   });
});

describe('randomGender', () => {
   it('returns a valid gender', () => {
      pickFirst();
      expect(randomGender()).toBe('male');
   });
});

describe('totalNameCount', () => {
   it('is a large positive integer', () => {
      const total = totalNameCount();
      expect(Number.isInteger(total)).toBe(true);
      expect(total).toBeGreaterThan(10_000);
   });
});
