import { afterEach, describe, expect, it, vi } from 'vitest';
import { advicePhrase } from './advice.js';
import { moodPhrase } from './mood.js';
import { celebratePhrase } from './reactions.js';

afterEach(() => vi.restoreAllMocks());

describe('advicePhrase', () => {
   it('returns a static quip on the rare 10% path', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(10) → true
      expect(advicePhrase()).toBe('I think you should visit a doctor.');
   });

   it('returns a non-empty line otherwise', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // chance(10) → false
      expect(advicePhrase().length).toBeGreaterThan(0);
   });
});

describe('moodPhrase', () => {
   it('ends with a place and a full stop', () => {
      expect(moodPhrase()).toMatch(/\.$/);
   });
});

describe('celebratePhrase', () => {
   it('always returns a non-empty string', () => {
      expect(celebratePhrase().length).toBeGreaterThan(0);
   });
});
