// Flow tests fake showModal and never serialize the builder, so a modal that
// fails builder validation (missing label, empty component list…) would only
// surface live. This suite runs every modal builder through toJSON() — the
// same validation Discord.js applies when the modal is actually shown.
import { ComponentType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { buildBodyModal, buildIdentityModal, buildRejectReasonModal } from './_characterModals.js';
import { buildSettingModal } from './_profileModals.js';
import type { CharacterIdentity } from '../../db/models/character.js';

const IDENTITY: CharacterIdentity = {
   name: 'Tosch',
   race: 'canid',
   epithet: 'the General',
   gender: 'male',
   bio: 'A general.',
   avatarUrl: '',
};

describe('modal builders serialize (post-action-row Label components)', () => {
   const cases = [
      ['identity (fresh)', () => buildIdentityModal({ customId: 'character:create', title: 'New character' })],
      ['identity (prefilled)', () => buildIdentityModal({ customId: 'character:panel-save:x', title: 'Edit', prefill: IDENTITY })],
      ['body', () => buildBodyModal({ customId: 'character:panel-save-body:x', prefill: { heightCm: 180, weightKg: 80, age: 30 } })],
      ['reject reason', () => buildRejectReasonModal('char-id', 'msg-id')],
      ['profile country (empty)', () => buildSettingModal('country', null)],
      ['profile timezone (prefilled)', () => buildSettingModal('timezone', 'Europe/Warsaw')],
   ] as const;

   it.each(cases)('%s', (_name, build) => {
      const json = build().toJSON();

      expect(json.components.length).toBeGreaterThan(0);
      for (const component of json.components) {
         expect(component.type).toBe(ComponentType.Label);
         if (component.type === ComponentType.Label)
            expect(component.component.type).toBe(ComponentType.TextInput);
      }
   });

   it('prefilled identity carries the current values', () => {
      const json = buildIdentityModal({ customId: 'x', title: 'Edit', prefill: IDENTITY }).toJSON();
      const inputs = json.components
         .filter((c) => c.type === ComponentType.Label)
         .map((c) => c.component)
         .filter((c) => c.type === ComponentType.TextInput);

      expect(inputs.map((input) => input.custom_id)).toEqual(['name', 'epithet', 'bio', 'avatarUrl']);
      expect(inputs[0].value).toBe('Tosch');
   });
});
