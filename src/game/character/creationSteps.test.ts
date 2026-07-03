import { describe, expect, it } from 'vitest';
import { CREATION_STEPS, creationStep, firstIncompleteStep, requiredStepsComplete } from './creationSteps.js';
import { isIdentityComplete } from './identity.js';
import type { CharacterDoc, CharacterIdentity } from '../../db/models/character.js';

function character(identity: Partial<CharacterIdentity> = {}): CharacterDoc {
   return {
      identity: { name: 'Tosch', race: 'canid', epithet: '', gender: '', bio: '', avatarUrl: '', ...identity },
   } as unknown as CharacterDoc;
}

describe('CREATION_STEPS catalog', () => {
   it('has unique step ids', () => {
      const ids = CREATION_STEPS.map((step) => step.id);
      expect(new Set(ids).size).toBe(ids.length);
   });

   it('resolves steps by id and rejects unknown ids', () => {
      expect(creationStep('race')?.title).toBe('Race');
      expect(creationStep('nope')).toBeUndefined();
   });

   it('reports completeness per step', () => {
      const c = character({ name: 'Kelric', race: null, gender: 'male' });
      expect(creationStep('details')!.isComplete(c)).toBe(true);
      expect(creationStep('race')!.isComplete(c)).toBe(false);
      expect(creationStep('gender')!.isComplete(c)).toBe(true);
   });

   it('summarizes current values with an em-dash fallback', () => {
      const c = character({ name: '', race: null, gender: '' });
      for (const step of CREATION_STEPS)
         expect(step.summary(c)).toBe('—');
   });
});

describe('firstIncompleteStep', () => {
   it('walks steps in catalog order, optional ones included', () => {
      expect(firstIncompleteStep(character({ name: '' }))?.id).toBe('details');
      expect(firstIncompleteStep(character({ race: null, gender: '' }))?.id).toBe('race');
      expect(firstIncompleteStep(character({ gender: '' }))?.id).toBe('gender');
   });

   it('returns undefined when everything is filled', () => {
      expect(firstIncompleteStep(character({ gender: 'female' }))).toBeUndefined();
   });
});

describe('requiredStepsComplete', () => {
   it('ignores optional steps', () => {
      expect(requiredStepsComplete(character({ gender: '' }))).toBe(true);
   });

   it('blocks on any missing required step', () => {
      expect(requiredStepsComplete(character({ name: ' a ' }))).toBe(false);
      expect(requiredStepsComplete(character({ race: null }))).toBe(false);
   });

   // canSubmit moved from isIdentityComplete to the catalog (D20); this pins
   // the two definitions of "minimum viable identity" together so they can't
   // silently drift apart.
   it('agrees with isIdentityComplete on the required minimum', () => {
      const cases = [
         character(),
         character({ name: '' }),
         character({ name: 'x' }),
         character({ race: null }),
         character({ name: '', race: null }),
      ];

      for (const c of cases)
         expect(requiredStepsComplete(c)).toBe(isIdentityComplete(c.identity));
   });
});
