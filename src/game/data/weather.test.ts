import { afterEach, describe, expect, it, vi } from 'vitest';
import { WEATHER, resolveWeatherId, rollWeather } from './weather.js';

afterEach(() => {
   vi.restoreAllMocks();
});

describe('WEATHER catalog', () => {
   it('has sane durations and weights', () => {
      for (const [id, kind] of Object.entries(WEATHER)) {
         expect(kind.durationHours.min, `${id} duration min`).toBeGreaterThanOrEqual(1);
         expect(kind.durationHours.max, `${id} duration ordering`).toBeGreaterThanOrEqual(kind.durationHours.min);
         expect(kind.defaultWeight, `${id} weight`).toBeGreaterThan(0);
      }
   });
});

describe('resolveWeatherId', () => {
   it('falls back to clear skies for unknown kinds (D10 rule 3)', () => {
      expect(resolveWeatherId('rain')).toBe('rain');
      expect(resolveWeatherId('acid_hail')).toBe('clear');
   });
});

describe('rollWeather', () => {
   it('rolls a known kind with a duration inside its catalog range', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const spell = rollWeather('plaza', new Date(0));

      expect(spell.kind in WEATHER).toBe(true);
      const hours = (spell.until.getTime() - spell.since.getTime()) / 3_600_000;
      expect(hours).toBeGreaterThanOrEqual(WEATHER[spell.kind].durationHours.min);
      expect(hours).toBeLessThanOrEqual(WEATHER[spell.kind].durationHours.max);
   });
});
