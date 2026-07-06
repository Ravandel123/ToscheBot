import { describe, expect, it } from 'vitest';
import { canCharacterAct, canEdit, canSubmit } from './rules.js';
import { isIdentityComplete } from './identity.js';
import type { CharacterDoc, CharacterIdentity } from '../../db/models/character.js';

// A fully allocated point-buy (20+20+10 = CREATION_ATTRIBUTE_POINTS) so the
// required 'attributes' creation step reads as complete by default.
const FULL_ALLOCATION = { strength: 20, constitution: 20, agility: 10 };

function character(overrides: {
   status?: CharacterDoc['approvalStatus'];
   hp?: number;
   ap?: number;
   identity?: Partial<CharacterIdentity>;
   attributeAllocation?: Record<string, number>;
} = {}): CharacterDoc {
   return {
      approvalStatus: overrides.status ?? 'approved',
      resources: { health: { current: overrides.hp ?? 20, max: 20 }, stamina: { current: 10, max: 10 } },
      actionPoints: { current: overrides.ap ?? 5, totalEarned: 5 },
      identity: { name: 'Tosch', race: 'canid', epithet: '', gender: 'male', bio: '', ...overrides.identity },
      attributeAllocation: overrides.attributeAllocation ?? FULL_ALLOCATION,
   } as unknown as CharacterDoc;
}

describe('canCharacterAct', () => {
   it('allows an approved, healthy character with enough AP', () => {
      expect(canCharacterAct(character(), 3)).toEqual({ ok: true });
   });

   it('blocks an unapproved character', () => {
      expect(canCharacterAct(character({ status: 'draft' }))).toEqual({ ok: false, reason: 'not-approved' });
   });

   it('blocks a character at 0 HP', () => {
      expect(canCharacterAct(character({ hp: 0 }))).toEqual({ ok: false, reason: 'incapacitated' });
   });

   it('blocks when action points are insufficient', () => {
      expect(canCharacterAct(character({ ap: 1 }), 3)).toEqual({ ok: false, reason: 'no-action-points' });
   });
});

describe('canEdit', () => {
   it('allows draft and rejected characters', () => {
      expect(canEdit(character({ status: 'draft' }))).toBe(true);
      expect(canEdit(character({ status: 'rejected' }))).toBe(true);
   });

   it('blocks pending and approved characters', () => {
      expect(canEdit(character({ status: 'pending' }))).toBe(false);
      expect(canEdit(character({ status: 'approved' }))).toBe(false);
   });
});

describe('isIdentityComplete', () => {
   it('requires a real name and a chosen race', () => {
      expect(isIdentityComplete(character({ identity: { name: 'Tosch', race: 'canid' } }).identity)).toBe(true);
   });

   it('rejects a too-short name', () => {
      expect(isIdentityComplete(character({ identity: { name: 'a', race: 'canid' } }).identity)).toBe(false);
   });

   it('rejects a missing race', () => {
      expect(isIdentityComplete(character({ identity: { name: 'Tosch', race: null } }).identity)).toBe(false);
   });

   it('ignores surrounding whitespace in the name', () => {
      expect(isIdentityComplete(character({ identity: { name: '  T  ', race: 'canid' } }).identity)).toBe(false);
   });
});

describe('canSubmit', () => {
   it('allows a complete draft character', () => {
      expect(canSubmit(character({ status: 'draft' }))).toEqual({ ok: true });
   });

   it('blocks a pending character as not-editable', () => {
      expect(canSubmit(character({ status: 'pending' }))).toEqual({ ok: false, reason: 'not-editable' });
   });

   it('blocks an incomplete draft', () => {
      expect(canSubmit(character({ status: 'draft', identity: { race: null } }))).toEqual({ ok: false, reason: 'incomplete' });
   });

   it('blocks a draft without a chosen gender', () => {
      expect(canSubmit(character({ status: 'draft', identity: { gender: '' } }))).toEqual({ ok: false, reason: 'incomplete' });
   });

   it('blocks a draft with unspent attribute points (D25)', () => {
      expect(canSubmit(character({ status: 'draft', attributeAllocation: { strength: 10 } }))).toEqual({ ok: false, reason: 'incomplete' });
   });
});
