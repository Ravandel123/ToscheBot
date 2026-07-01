import { afterEach, describe, expect, it, vi } from 'vitest';
import { funnyEnding, FUNNY_WORDS } from './flavor.js';

afterEach(() => {
   vi.restoreAllMocks();
});

describe('funnyEnding', () => {
   it('always ends with the given punctuation', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // no funny word
      expect(funnyEnding('.')).toBe('.');
      expect(funnyEnding('?')).toBe('?');
   });

   it('slips in a funny word when the roll succeeds', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance hits, picks first word
      expect(funnyEnding('.')).toBe(`, ${FUNNY_WORDS[0]}.`);
   });
});
