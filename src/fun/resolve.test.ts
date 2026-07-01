import { afterEach, describe, expect, it, vi } from 'vitest';
import { personGrammar } from '../lib/person.js';
import { resolveVerdict, RESOLVE_EMOJI } from './resolve.js';

afterEach(() => vi.restoreAllMocks());

describe('resolveVerdict', () => {
   it('agrees with the subject and bolds a capitalized trait + emoji', () => {
      expect(resolveVerdict(personGrammar('Tosche'))).toMatch(/^Tosche is \*\*[A-Z][a-z-]+ (😰|✨)\*\*$/u);
      expect(resolveVerdict(personGrammar('me'))).toMatch(/^You are \*\*/);
   });

   it('gives an affliction when the resolve roll fails (75% path)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance(75) → true
      expect(resolveVerdict(personGrammar('Tosche'))).toContain(RESOLVE_EMOJI.affliction);
   });

   it('gives a virtue when the resolve roll passes', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // chance(75) → false
      expect(resolveVerdict(personGrammar('Tosche'))).toContain(RESOLVE_EMOJI.virtue);
   });
});
