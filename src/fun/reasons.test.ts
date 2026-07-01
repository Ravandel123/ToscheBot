import { afterEach, describe, expect, it, vi } from 'vitest';
import { reasonCore, howAnswer, whyAnswer } from './reasons.js';

afterEach(() => vi.restoreAllMocks());

describe('reasonCore', () => {
   it('returns a solo bolded phrase on the 60% path', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(60) → true
      expect(reasonCore()).toMatch(/^\*\*.+\*\*$/);
   });

   it('composes "the **Adjective Noun**" on the other path', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // chance(60) → false
      expect(reasonCore()).toMatch(/^the \*\*\w+ \w+\*\*$/);
   });
});

describe('how/why answers', () => {
   it('always produce a non-empty string', () => {
      expect(howAnswer().length).toBeGreaterThan(0);
      expect(whyAnswer().length).toBeGreaterThan(0);
   });

   it('whyAnswer returns pure attitude on the rare path', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(15) → true
      expect(whyAnswer()).toMatch(/Because|won't|small mind/);
   });
});
