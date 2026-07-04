import { describe, expect, it } from 'vitest';
import { LOCATION_STATS, initialStats, statBand, statValue } from './locationStats.js';

describe('initialStats', () => {
   it('starts from catalog defaults and applies location overrides', () => {
      expect(initialStats('riverbank').danger).toBe(20);
      expect(initialStats('spire').danger).toBe(0);
      expect(initialStats('tavern').prosperity).toBe(60);
   });

   it('falls back to the starting location for unknown ids (D10 rule 3)', () => {
      expect(initialStats('atlantis')).toEqual(initialStats('spire'));
   });
});

describe('statValue', () => {
   it('prefers the stored value, clamped to the catalog range', () => {
      expect(statValue('spire', { danger: 40 }, 'danger')).toBe(40);
      expect(statValue('spire', { danger: 250 }, 'danger')).toBe(100);
      expect(statValue('spire', { danger: -5 }, 'danger')).toBe(0);
   });

   it('falls back to the location initial for missing keys (a stat added after the doc)', () => {
      expect(statValue('riverbank', {}, 'danger')).toBe(20);
      expect(statValue('riverbank', undefined, 'prosperity')).toBe(30);
   });
});

describe('statBand', () => {
   it('maps the extremes to the first and last band', () => {
      expect(statBand('danger', LOCATION_STATS.danger.min)).toBe(LOCATION_STATS.danger.bands[0]);
      expect(statBand('danger', LOCATION_STATS.danger.max)).toBe(LOCATION_STATS.danger.bands.at(-1));
   });

   it('steps through the bands as the value grows', () => {
      expect(statBand('danger', 30)).toBe('uneasy');
      expect(statBand('danger', 60)).toBe('dangerous');
   });
});
