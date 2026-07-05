// Discord adapter (marked): builds the identity modal (used by `/character
// create`, both for a brand-new draft and for resuming an editable one) and
// the reject-reason modal, and reads their submitted values back. Modals only
// host text inputs — race is a separate wizard step (no select menus inside modals).
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ModalSubmitInteraction } from 'discord.js';
import {
   AVATAR_URL_MAX_LENGTH,
   BIO_MAX_LENGTH,
   EPITHET_MAX_LENGTH,
   NAME_MAX_LENGTH,
   NAME_MIN_LENGTH,
} from '../../game/character/identity.js';
import type { CharacterIdentity } from '../../db/models/character.js';
import type { EditableIdentity } from '../../db/services/characterService.js';
import type { CharacterBody } from '../../game/character/body.js';

const REASON_MAX_LENGTH = 300;

function row(input: TextInputBuilder): ActionRowBuilder<TextInputBuilder> {
   return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

function textInput(
   id: string,
   label: string,
   style: TextInputStyle,
   opts: { required?: boolean; min?: number; max?: number; value?: string },
): TextInputBuilder {
   const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(opts.required ?? false);
   if (opts.min !== undefined) input.setMinLength(opts.min);
   if (opts.max !== undefined) input.setMaxLength(opts.max);
   if (opts.value) input.setValue(opts.value); // skip empty — setValue('') is pointless and noisy
   return input;
}

/**
 * Identity (text-fields) modal. The caller owns the `customId` — it decides which
 * flow the submit routes to (`character:create` lands on the panel; a panel's
 * `character:panel-save:<id>` updates the panel in place). `prefill` pre-fills
 * current values for editing.
 */
export function buildIdentityModal(opts: { customId: string; title: string; prefill?: CharacterIdentity }): ModalBuilder {
   const p = opts.prefill;

   return new ModalBuilder()
      .setCustomId(opts.customId)
      .setTitle(opts.title)
      .addComponents(
         row(textInput('name', 'Name', TextInputStyle.Short, { required: true, min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH, value: p?.name })),
         row(textInput('epithet', 'Epithet (e.g. "the Tavern Keep")', TextInputStyle.Short, { max: EPITHET_MAX_LENGTH, value: p?.epithet })),
         row(textInput('bio', 'Short description', TextInputStyle.Paragraph, { max: BIO_MAX_LENGTH, value: p?.bio })),
         row(textInput('avatarUrl', 'Avatar image URL (optional)', TextInputStyle.Short, { max: AVATAR_URL_MAX_LENGTH, value: p?.avatarUrl })),
      );
}

// Race and gender are panel selects (modals can't host lists), so the modal only
// carries the free-text fields.
export function readIdentityModal(interaction: ModalSubmitInteraction): EditableIdentity & { name: string } {
   return {
      name: interaction.fields.getTextInputValue('name').trim(),
      epithet: interaction.fields.getTextInputValue('epithet').trim(),
      bio: interaction.fields.getTextInputValue('bio').trim(),
      avatarUrl: interaction.fields.getTextInputValue('avatarUrl').trim(),
   };
}

/** Body (frame) modal — the creation step's height/weight/age fields (R20). All
 *  metric; the panel prefills current values (a fresh draft has race defaults).
 *  The caller owns the `customId` (`character:panel-save-body:<id>`). */
export function buildBodyModal(opts: { customId: string; prefill: CharacterBody }): ModalBuilder {
   const b = opts.prefill;

   return new ModalBuilder()
      .setCustomId(opts.customId)
      .setTitle('Physical frame')
      .addComponents(
         row(textInput('heightCm', 'Height (cm)', TextInputStyle.Short, { required: true, max: 4, value: String(b.heightCm) })),
         row(textInput('weightKg', 'Weight (kg)', TextInputStyle.Short, { required: true, max: 4, value: String(b.weightKg) })),
         row(textInput('age', 'Age (years)', TextInputStyle.Short, { required: true, max: 4, value: String(b.age) })),
      );
}

/** Reads the raw body strings back; game/character/body.ts parseBody clamps them. */
export function readBodyModal(interaction: ModalSubmitInteraction): Record<'heightCm' | 'weightKg' | 'age', string> {
   return {
      heightCm: interaction.fields.getTextInputValue('heightCm'),
      weightKg: interaction.fields.getTextInputValue('weightKg'),
      age: interaction.fields.getTextInputValue('age'),
   };
}

/** Reason prompt shown when the owner clicks Reject. Carries the decree message id so it can be edited afterwards. */
export function buildRejectReasonModal(characterId: string, messageId: string): ModalBuilder {
   return new ModalBuilder()
      .setCustomId(`character:reject-reason:${characterId}:${messageId}`)
      .setTitle('Reject petition')
      .addComponents(row(textInput('reason', 'Reason for rejection', TextInputStyle.Paragraph, { required: true, max: REASON_MAX_LENGTH })));
}
