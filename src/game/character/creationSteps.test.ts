import { describe, expect, it } from 'vitest';
import { CREATION_STEPS, creationStep, firstIncompleteStep, requiredStepsComplete } from './creationSteps.js';
import { isIdentityComplete } from './identity.js';
import { CREATION_ATTRIBUTE_POINTS } from './attributes.js';
import type { CharacterDoc, CharacterIdentity } from '../../db/models/character.js';

// 20+20+10 = CREATION_ATTRIBUTE_POINTS — the attributes step reads complete.
const FULL_ALLOCATION = { strength: 20, consitution: 20, agility: 10 };

function character(identity: Partial<CharacterIdentity> = {}, attributeAllocation: Record<string, number> = FULL_ALLOCATION): CharacterDoc {
   return {
      identity: { name: 'Tosch', race: 'canid', epithet: '', gender: '', bio: '', avatarUrl: '', ...identity },
      attributeAllocation,
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
      expect(creationStep('attributes')!.isComplete(c)).toBe(true);
      expect(creationStep('attributes')!.isComplete(character({}, {}))).toBe(false);
   });

   it('summarizes current values with an em-dash fallback', () => {
      const c = character({ name: '', race: null, gender: '' }, {});
      // 'attributes' and 'body' are always populated (a point pool / a default
      // frame), so they never fall back to '—'.
      for (const step of CREATION_STEPS.filter((s) => s.id !== 'attributes' && s.id !== 'body'))
         expect(step.summary(c)).toBe('—');
      expect(creationStep('attributes')!.summary(c)).toBe(`0/${CREATION_ATTRIBUTE_POINTS} points assigned`);
      // The body step summarizes the (defaulted) frame, not '—'.
      const bodySummary = creationStep('body')!.summary(c);
      expect(bodySummary).toContain('cm');
      expect(bodySummary).toContain('kg');
      expect(bodySummary).toContain('age');
   });
});

describe('firstIncompleteStep', () => {
   it('walks steps in catalog order, optional ones included', () => {
      expect(firstIncompleteStep(character({ name: '' }))?.id).toBe('details');
      expect(firstIncompleteStep(character({ race: null, gender: '' }))?.id).toBe('race');
      expect(firstIncompleteStep(character({ gender: '' }))?.id).toBe('gender');
      expect(firstIncompleteStep(character({ gender: 'male' }, {}))?.id).toBe('attributes');
   });

   it('returns undefined when everything is filled', () => {
      expect(firstIncompleteStep(character({ gender: 'female' }))).toBeUndefined();
   });
});

describe('requiredStepsComplete', () => {
   it('passes a fully filled character', () => {
      expect(requiredStepsComplete(character({ gender: 'female' }))).toBe(true);
   });

   it('blocks on any missing required step', () => {
      expect(requiredStepsComplete(character({ name: ' a ', gender: 'male' }))).toBe(false);
      expect(requiredStepsComplete(character({ race: null, gender: 'male' }))).toBe(false);
      expect(requiredStepsComplete(character({ gender: '' }))).toBe(false);
      expect(requiredStepsComplete(character({ gender: 'male' }, { strength: 10 }))).toBe(false);
   });

   // canSubmit moved from isIdentityComplete to the catalog (D20); with the
   // gender + point-buy steps held constant (complete) the identity half must
   // still agree with isIdentityComplete so the two can't silently drift apart.
   it('agrees with isIdentityComplete on the required identity minimum', () => {
      const cases = [
         character({ gender: 'male' }),
         character({ name: '', gender: 'male' }),
         character({ name: 'x', gender: 'male' }),
         character({ race: null, gender: 'male' }),
         character({ name: '', race: null, gender: 'male' }),
      ];

      for (const c of cases)
         expect(requiredStepsComplete(c)).toBe(isIdentityComplete(c.identity));
   });
});
