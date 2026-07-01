import { describe, expect, it } from 'vitest';
import { expectedScore, eloChange } from './elo.js';

describe('elo', () => {
   it('gives equal players a 50% expected score', () => {
      expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
   });

   it('favours the higher-rated player', () => {
      expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
      expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
   });

   it('awards equal players the half K-factor on a win', () => {
      // K=32, expected 0.5 → 32 * (1 - 0.5) = 16
      expect(eloChange(1000, 1000, 1)).toBe(16);
   });

   it('awards a favourite less for beating an underdog', () => {
      const favourite = eloChange(1400, 1000, 1);
      const underdog = eloChange(1000, 1400, 1);
      expect(favourite).toBeLessThan(underdog);
   });
});
