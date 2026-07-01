import { afterEach, describe, expect, it, vi } from 'vitest';
import { animalRoast, raceRoast, classRoast, composedClass, whoisPhrase } from './roast.js';

afterEach(() => vi.restoreAllMocks());

describe('roast frames', () => {
   it('mention the target and stay non-empty', () => {
      for (const fn of [animalRoast, raceRoast, classRoast, whoisPhrase]) {
         const out = fn('Clovis');
         expect(out).toContain('Clovis');
         expect(out.length).toBeGreaterThan(0);
      }
   });
});

describe('composedClass', () => {
   it('is plain on the 65% path', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // chance(35) → false
      expect(composedClass()).not.toContain(' ');
   });

   it('prefixes a class on the other path', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(35) → true, picks index 0
      expect(composedClass()).toBe('Battle Abbot');
   });
});
