import { describe, expect, it } from 'vitest';
import { countSyllables, gerund, indefiniteArticle, pastTense, pluralize, thirdPerson } from './inflect.js';

describe('countSyllables', () => {
   it('counts vowel groups with the old bot heuristics', () => {
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
      expect(pastTense('smite')).toBe('smote');
      expect(pastTense('strike')).toBe('struck');
   });

   it('reaches irregular bases through verb prefixes', () => {
      expect(pastTense('outrun')).toBe('outran');
      expect(pastTense('outdrink')).toBe('outdrank');
      expect(pastTense('oversee')).toBe('oversaw');
   });

   it('applies the regular spelling rules', () => {
      expect(pastTense('stop')).toBe('stopped'); // CVC monosyllable doubles
      expect(pastTense('carry')).toBe('carried'); // consonant + y → ied
      expect(pastTense('play')).toBe('played');   // vowel + y → just ed
      expect(pastTense('dance')).toBe('danced');  // silent-e → d
      expect(pastTense('visit')).toBe('visited'); // 2 syllables → no doubling
      expect(pastTense('jump')).toBe('jumped');
      expect(pastTense('overwork')).toBe('overworked'); // prefixed regular stays regular
   });
});

describe('thirdPerson', () => {
   it('uses the irregular table', () => {
      expect(thirdPerson('be')).toBe('is');
      expect(thirdPerson('have')).toBe('has');
      expect(thirdPerson('do')).toBe('does');
      expect(thirdPerson('go')).toBe('goes');
   });

   it('applies the regular spelling rules', () => {
      expect(thirdPerson('smite')).toBe('smites');
      expect(thirdPerson('catch')).toBe('catches');  // sibilant → es
      expect(thirdPerson('bless')).toBe('blesses');
      expect(thirdPerson('harry')).toBe('harries');  // consonant + y → ies
      expect(thirdPerson('stay')).toBe('stays');     // vowel + y → just s
      expect(thirdPerson('echo')).toBe('echoes');    // -o → es
      expect(thirdPerson('outdo')).toBe('outdoes');  // prefix + irregular base
   });
});

describe('gerund', () => {
   it('applies the participle spelling rules', () => {
      expect(gerund('run')).toBe('running');    // CVC monosyllable doubles
      expect(gerund('make')).toBe('making');    // silent-e dropped
      expect(gerund('see')).toBe('seeing');     // -ee kept
      expect(gerund('die')).toBe('dying');      // -ie → ying
      expect(gerund('be')).toBe('being');
      expect(gerund('toast')).toBe('toasting');
      expect(gerund('outrun')).toBe('outrunning'); // doubling through the prefix
      expect(gerund('visit')).toBe('visiting');    // 2 syllables → no doubling
   });
});

describe('pluralize', () => {
   it('uses the irregular table, preserving a leading capital', () => {
      expect(pluralize('wolf')).toBe('wolves');
      expect(pluralize('Wolf')).toBe('Wolves');
      expect(pluralize('man')).toBe('men');
      expect(pluralize('sheep')).toBe('sheep');
   });

   it('applies the regular spelling rules', () => {
      expect(pluralize('skull')).toBe('skulls');
      expect(pluralize('class')).toBe('classes');   // sibilant → es
      expect(pluralize('fox')).toBe('foxes');
      expect(pluralize('story')).toBe('stories');   // consonant + y → ies
      expect(pluralize('day')).toBe('days');        // vowel + y → just s
      expect(pluralize('hero')).toBe('heroes');     // common -o → es
      expect(pluralize('piano')).toBe('pianos');    // uncommon -o → s
   });

   it('pluralizes the last word of a phrase', () => {
      expect(pluralize('rocket launcher')).toBe('rocket launchers');
      expect(pluralize('mountain wolf')).toBe('mountain wolves');
   });
});

describe('indefiniteArticle', () => {
   it('falls back to leading-vowel', () => {
      expect(indefiniteArticle('otter')).toBe('an');
      expect(indefiniteArticle('wolf')).toBe('a');
   });

   it('honours the exception tables', () => {
      expect(indefiniteArticle('unicorn')).toBe('a');
      expect(indefiniteArticle('university')).toBe('a');
      expect(indefiniteArticle('honour')).toBe('an');
      expect(indefiniteArticle('heir')).toBe('an');
   });

   it('returns no article for uncountables', () => {
      expect(indefiniteArticle('water')).toBe('');
      expect(indefiniteArticle('information')).toBe('');
   });

   it('decides by the first word of a phrase', () => {
      expect(indefiniteArticle('angry wolf')).toBe('an');
      expect(indefiniteArticle('used sword')).toBe('a');
   });
});
