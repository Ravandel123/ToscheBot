import { afterEach, describe, expect, it, vi } from 'vitest';
import { expand } from './compose.js';
import {
   randomSentence, SCENE_PATTERNS, SITUATION_THEMES, SUBJECT_PATTERNS, themeGrammar,
} from './sentence.js';

afterEach(() => vi.restoreAllMocks());

describe('themeGrammar', () => {
   it('exposes all five word-class symbols for a situation theme', () => {
      const grammar = themeGrammar(['combat']);
      for (const symbol of ['adjective', 'adverb', 'being', 'noun', 'verb'])
         expect(grammar[symbol]?.length, symbol).toBeGreaterThan(0);
   });

   it('merges and dedupes pools across themes', () => {
      const combat = themeGrammar(['combat']);
      const merged = themeGrammar(['combat', 'wilds']);
      expect(merged.verb.length).toBeGreaterThan(combat.verb.length);
      expect(new Set(merged.verb).size).toBe(merged.verb.length);
   });

   it('omits symbols for classes without the theme', () => {
      const grammar = themeGrammar(['certainty']); // an adverb-only legacy theme
      expect(grammar.adverb).toBeDefined();
      expect(grammar.verb).toBeUndefined();
      expect(grammar.being).toBeUndefined();
   });
});

describe('sentence patterns', () => {
   it('every pattern fully resolves for every situation theme', () => {
      for (const theme of SITUATION_THEMES)
         for (const pattern of [...SCENE_PATTERNS, ...SUBJECT_PATTERNS]) {
            const sentence = expand({ ...themeGrammar([theme]), origin: [pattern], subject: ['Tosch'] });
            expect(sentence, `${theme} × "${pattern}"`).not.toContain('#');
         }
   });
});

describe('randomSentence', () => {
   it('composes a scene line deterministically under a fixed RNG', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // every randomItem → index 0
      expect(randomSentence(['combat']))
         .toBe('A bandit fearlessly ambushes a bandit near the armory.');
   });

   it('stars the given subject', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(randomSentence(['combat'], { subject: 'Tosch' }))
         .toBe('Tosch fearlessly ambushes a bandit.');
   });

   it('always yields a clean, closed sentence', () => {
      for (let i = 0; i < 50; i++) {
         const sentence = randomSentence([...SITUATION_THEMES]);
         expect(sentence).not.toContain('#');
         expect(sentence).toMatch(/^[A-Z]/);
         expect(sentence).toMatch(/\.$/);
      }
   });
});
