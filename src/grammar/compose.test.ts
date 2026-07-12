import { afterEach, describe, expect, it, vi } from 'vitest';
import { expand } from './compose.js';

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
      expect(expand({ origin: ['#w.s#'], w: ['wolf'] })).toBe('wolves'); // real plural rules, not naive +s
   });

   it('applies the verb modifiers: past, third, ing', () => {
      expect(expand({ origin: ['#verb.past#'], verb: ['conquer'] })).toBe('conquered');
      expect(expand({ origin: ['#verb.past#'], verb: ['go'] })).toBe('went');
      expect(expand({ origin: ['#verb.third#'], verb: ['smite'] })).toBe('smites');
      expect(expand({ origin: ['#verb.third#'], verb: ['have'] })).toBe('has');
      expect(expand({ origin: ['#verb.ing#'], verb: ['run'] })).toBe('running');
   });

   it('chains modifiers left to right', () => {
      expect(expand({ origin: ['#animal.a.capitalize#'], animal: ['otter'] })).toBe('An otter');
      expect(expand({ origin: ['#w.s.capitalize#'], w: ['wolf'] })).toBe('Wolves');
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
