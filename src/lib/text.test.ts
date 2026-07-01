import { describe, expect, it } from 'vitest';
import { bold, italic, underline, capitalize, countSyllables, indefiniteArticle, pastTense } from './text.js';

describe('text helpers', () => {
   it('wraps with markdown', () => {
      expect(bold('x')).toBe('**x**');
      expect(italic('x')).toBe('*x*');
      expect(underline('x')).toBe('__x__');
   });

   it('capitalizes the first letter and leaves the rest', () => {
      expect(capitalize('hello world')).toBe('Hello world');
   });

   it('handles an empty string', () => {
      expect(capitalize('')).toBe('');
   });
});

describe('countSyllables', () => {
   it('counts vowel groups heuristically', () => {
      expect(countSyllables('hello')).toBe(2);
      expect(countSyllables('code')).toBe(1);     // silent-e stripped
      expect(countSyllables('syllable')).toBe(3);
      expect(countSyllables('deltrada')).toBe(3);
      expect(countSyllables('stopped')).toBe(1);  // -ed stripped
   });
});

describe('pastTense', () => {
   it('uses the irregular table', () => {
      expect(pastTense('go')).toBe('went');
      expect(pastTense('make')).toBe('made');
      expect(pastTense('think')).toBe('thought');
   });

   it('applies regular spelling rules', () => {
      expect(pastTense('stop')).toBe('stopped'); // CVC monosyllable doubles
      expect(pastTense('carry')).toBe('carried'); // consonant + y → ied
      expect(pastTense('play')).toBe('played');   // vowel + y → just ed
      expect(pastTense('dance')).toBe('danced');  // silent-e → d
      expect(pastTense('visit')).toBe('visited'); // 2 syllables → no doubling
      expect(pastTense('jump')).toBe('jumped');
   });
});

describe('indefiniteArticle', () => {
   it('uses leading vowel by default', () => {
      expect(indefiniteArticle('otter')).toBe('an');
      expect(indefiniteArticle('wolf')).toBe('a');
   });

   it('honours the a/an exceptions', () => {
      expect(indefiniteArticle('unicorn')).toBe('a');
      expect(indefiniteArticle('university')).toBe('a');
      expect(indefiniteArticle('honour')).toBe('an');
      expect(indefiniteArticle('heir')).toBe('an');
   });

   it('returns no article for uncountable nouns', () => {
      expect(indefiniteArticle('water')).toBe('');
      expect(indefiniteArticle('information')).toBe('');
   });

   it('agrees with the first word of a phrase', () => {
      expect(indefiniteArticle('angry wolf')).toBe('an');
      expect(indefiniteArticle('used sword')).toBe('a');
   });
});
