import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomWeapon, weaponList, hugPhrase, rantReply } from './reactions.js';

afterEach(() => vi.restoreAllMocks());

describe('weapons', () => {
   it('randomWeapon is bold and capitalized', () => {
      expect(randomWeapon()).toMatch(/^\*\*[A-Z].*\*\*$/);
   });

   it('weaponList returns 3–7 lines', () => {
      const lines = weaponList().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.length).toBeLessThanOrEqual(7);
   });
});

describe('hugPhrase', () => {
   it('refuses on the 15% path, mentioning the target or a deflection', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(15) → true
      expect(hugPhrase('Bob')).toContain('Bob');
   });
});

describe('rantReply', () => {
   it('uses the empty-rant pool when there is no content', () => {
      expect(rantReply(false)).toMatch(/rants about nothing|write something/);
   });

   it('returns something for a real rant', () => {
      expect(rantReply(true).length).toBeGreaterThan(0);
   });
});
