import { afterEach, describe, expect, it, vi } from 'vitest';
import { expand } from './grammar.js';

afterEach(() => vi.restoreAllMocks());

describe('expand', () => {
   it('expands nested symbols recursively', () => {
      const grammar = { origin: ['#greeting#, #place#!'], greeting: ['Hail'], place: ['Deltrada'] };
      expect(expand(grammar)).toBe('Hail, Deltrada!');
   });

   it('applies the a/an modifier, honouring exceptions', () => {
      expect(expand({ origin: ['#animal.a#'], animal: ['otter'] })).toBe('an otter');
      expect(expand({ origin: ['#animal.a#'], animal: ['wolf'] })).toBe('a wolf');
      expect(expand({ origin: ['#x.a#'], x: ['unicorn'] })).toBe('a unicorn'); // looks vowel-led, isn't
      expect(expand({ origin: ['#x.a#'], x: ['honour'] })).toBe('an honour'); // silent h
      expect(expand({ origin: ['#x.a#'], x: ['water'] })).toBe('water'); // uncountable → no article
   });

   it('applies the capitalize and s modifiers', () => {
      expect(expand({ origin: ['#w.capitalize#'], w: ['hail'] })).toBe('Hail');
      expect(expand({ origin: ['#w.s#'], w: ['skull'] })).toBe('skulls');
   });

   it('applies the past-tense modifier', () => {
      expect(expand({ origin: ['#verb.past#'], verb: ['conquer'] })).toBe('conquered');
      expect(expand({ origin: ['#verb.past#'], verb: ['go'] })).toBe('went');
   });

   it('leaves an unknown symbol visible', () => {
      expect(expand({ origin: ['x #missing# y'] })).toBe('x #missing# y');
   });

   it('lets runtime symbols be merged into a static grammar', () => {
      const base = { origin: ['You owe #price#'] };
      expect(expand({ ...base, price: ['7 coins'] })).toBe('You owe 7 coins');
   });

   it('picks among rules using the RNG', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // randomItem → index 0
      expect(expand({ origin: ['#x#'], x: ['first', 'second'] })).toBe('first');
   });
});
