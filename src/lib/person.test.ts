import { describe, expect, it } from 'vitest';
import { personGrammar } from './person.js';

describe('personGrammar', () => {
   it('addresses the speaker in the second person for empty/self inputs', () => {
      for (const input of [undefined, '', '  ', 'me', 'I', 'you', 'YOU']) {
         const p = personGrammar(input);
         expect(p.pronoun).toBe('you');
         expect(p.pronounCap).toBe('You');
         expect(p.verb).toBe('are');
         expect(p.subjectIs).toBe('you are');
         expect(p.subjectWas).toBe('you were');
         expect(p.subjectHas).toBe('you have');
         expect(p.determiner).toBe('your');
         expect(p.verbS).toBe('');
      }
   });

   it('uses the third person for a named target', () => {
      const p = personGrammar('Clovis');
      expect(p.pronoun).toBe('Clovis');
      expect(p.pronounCap).toBe('Clovis');
      expect(p.verb).toBe('is');
      expect(p.subjectIs).toBe('Clovis is');
      expect(p.subjectWas).toBe('Clovis was');
      expect(p.subjectHas).toBe('Clovis has');
      expect(p.determiner).toBe("Clovis's");
      expect(p.verbS).toBe('s');
   });

   it('capitalizes a lowercase name for sentence starts', () => {
      expect(personGrammar('clovis').pronounCap).toBe('Clovis');
   });
});
