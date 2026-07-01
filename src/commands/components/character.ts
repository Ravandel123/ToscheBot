import {
   MessageFlags,
   type ButtonInteraction,
   type ModalSubmitInteraction,
   type StringSelectMenuInteraction,
} from 'discord.js';
import { ComponentHandler } from '../../types/interactions.js';
import { config } from '../../config.js';
import { settings } from '../../settings.js';
import { characterService } from '../../db/services/characterService.js';
import { accountService } from '../../db/services/accountService.js';
import { canEdit, canSubmit, MAX_CHARACTERS_PER_ACCOUNT } from '../../game/character/rules.js';
import { resolveGuildChannel } from '../../lib/discord.js';
import { readIdentityModal, buildIdentityModal, buildRejectReasonModal } from './_characterModals.js';
import { buildDecidedDecree, buildDecreeButtons, buildDecreeEmbed } from './_characterDecree.js';
import { buildCharacterPanel } from './_characterPanel.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { RaceId } from '../../game/data/races.js';
import type { ToscheClient } from '../../client.js';

// Handles every `character:*` interaction:
//   panel-race / panel-edit / panel-save / panel-submit + create → the player's
//     interactive creation panel (race dropdown, text modal, submit);
//   approve / reject / reject-reason → the owner's verdict on a petition.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export default {
   namespace: 'character',
   async handle(client, interaction) {
      const [, action, ...rest] = interaction.customId.split(':');

      if (interaction.isModalSubmit()) {
         if (action === 'create') return handleCreateModal(client, interaction);
         if (action === 'panel-save') return handlePanelSave(interaction, rest[0]);
         if (action === 'reject-reason') return handleRejectReason(client, interaction, rest[0], rest[1]);
         return;
      }

      if (interaction.isButton()) {
         if (action === 'panel-edit') return handlePanelEdit(interaction, rest[0]);
         if (action === 'panel-submit') return handlePanelSubmit(interaction, rest[0]);
         if (action === 'approve') return handleApprove(client, interaction, rest[0]);
         if (action === 'reject') return handleRejectButton(interaction, rest[0]);
         return;
      }

      if (interaction.isStringSelectMenu()) {
         if (action === 'panel-race') return handlePanelRace(interaction, rest[0]);
         if (action === 'panel-gender') return handlePanelGender(interaction, rest[0]);
      }
   },
} satisfies ComponentHandler;

// --- Creation panel ---------------------------------------------------------

async function handleCreateModal(client: ToscheClient, interaction: ModalSubmitInteraction): Promise<void> {
   if (await characterService.countOwned(interaction.user.id) >= MAX_CHARACTERS_PER_ACCOUNT) {
      await interaction.reply({ content: `You already command ${MAX_CHARACTERS_PER_ACCOUNT} characters — the maximum.`, ...ephemeral });
      return;
   }

   const identity = readIdentityModal(interaction);
   const character = await characterService.create(interaction.user.id, identity);
   await accountService.setActiveCharacter(interaction.user.id, interaction.user.displayName, character._id, client.locks);

   // Land straight on the panel — pick a race and submit, all in one place.
   await interaction.reply({ ...buildCharacterPanel(character), ...ephemeral });
}

async function handlePanelRace(interaction: StringSelectMenuInteraction, characterId: string): Promise<void> {
   const character = await ownedEditable(interaction, characterId);
   if (!character)
      return;

   const race = interaction.values[0] as RaceId;
   await characterService.setRace(characterId, race);
   await interaction.update(buildCharacterPanel({ ...character, identity: { ...character.identity, race } }));
}

async function handlePanelGender(interaction: StringSelectMenuInteraction, characterId: string): Promise<void> {
   const character = await ownedEditable(interaction, characterId);
   if (!character)
      return;

   const gender = interaction.values[0];
   await characterService.updateIdentity(characterId, { gender });
   await interaction.update(buildCharacterPanel({ ...character, identity: { ...character.identity, gender } }));
}

async function handlePanelEdit(interaction: ButtonInteraction, characterId: string): Promise<void> {
   const character = await ownedEditable(interaction, characterId);
   if (!character)
      return;

   // The modal is opened from this panel message, so its submit can update it in place.
   await interaction.showModal(buildIdentityModal({
      customId: `character:panel-save:${characterId}`,
      title: 'Edit your character',
      prefill: character.identity,
   }));
}

async function handlePanelSave(interaction: ModalSubmitInteraction, characterId: string): Promise<void> {
   const character = await ownedEditable(interaction, characterId);
   if (!character)
      return;

   const identity = readIdentityModal(interaction);
   await characterService.updateIdentity(characterId, identity);
   const updated: CharacterDoc = { ...character, identity: { ...character.identity, ...identity } };

   if (interaction.isFromMessage())
      await interaction.update(buildCharacterPanel(updated));
   else
      await interaction.reply({ ...buildCharacterPanel(updated), ...ephemeral });
}

async function handlePanelSubmit(interaction: ButtonInteraction, characterId: string): Promise<void> {
   const character = await ownedEditable(interaction, characterId);
   if (!character)
      return;

   const check = canSubmit(character);
   if (!check.ok) {
      await interaction.reply({
         content: check.reason === 'incomplete'
            ? 'Give it a name (2+ characters) and a race before submitting.'
            : "That character can't be submitted right now.",
         ...ephemeral,
      });
      return;
   }

   if (!interaction.guild) {
      await interaction.reply({ content: 'Petitions are filed on the server, not in DMs.', ...ephemeral });
      return;
   }

   const channel = resolveGuildChannel(interaction.guild, settings.channels.imperialDecrees);
   if (!channel?.isSendable()) {
      await interaction.reply({
         content: 'The Hall of Decrees is missing. Ask the Imperator to set `channels.imperialDecrees` in settings.',
         ...ephemeral,
      });
      return;
   }

   await channel.send({ embeds: [buildDecreeEmbed(character)], components: [buildDecreeButtons(characterId)] });

   // Guarded transition: a double-click races here — the loser posted a
   // duplicate decree (its buttons will report "no longer pending" when used).
   if (!await characterService.submitForApproval(characterId)) {
      await interaction.reply({ content: 'That petition was already filed.', ...ephemeral });
      return;
   }

   await interaction.update(buildCharacterPanel({ ...character, approvalStatus: 'pending' }));
}

// --- Owner verdict flows ----------------------------------------------------

async function handleApprove(client: ToscheClient, interaction: ButtonInteraction, characterId: string): Promise<void> {
   if (!isOwner(interaction)) {
      await interaction.reply({ content: 'Only the Imperator passes judgement.', ...ephemeral });
      return;
   }

   const character = await characterService.get(characterId);
   if (!character) {
      await interaction.update({ components: [] });
      await interaction.followUp({ content: 'That character no longer exists.', ...ephemeral });
      return;
   }

   // Guarded: this decree may be stale (petition already decided, or the
   // character was rejected and re-edited since). Never approve those.
   if (!await characterService.approve(characterId)) {
      await interaction.update({ components: [] });
      await interaction.followUp({ content: 'That petition is no longer pending — it was already decided or has changed since.', ...ephemeral });
      return;
   }

   const decided: CharacterDoc = { ...character, approvalStatus: 'approved' };
   await interaction.update({ embeds: [buildDecidedDecree(decided, 'approved', interaction.user.id)], components: [] });
   await notifyPlayer(client, character, 'approved');
}

async function handleRejectButton(interaction: ButtonInteraction, characterId: string): Promise<void> {
   if (!isOwner(interaction)) {
      await interaction.reply({ content: 'Only the Imperator passes judgement.', ...ephemeral });
      return;
   }

   // The reason modal carries the decree message id so we can edit it after.
   await interaction.showModal(buildRejectReasonModal(characterId, interaction.message.id));
}

async function handleRejectReason(client: ToscheClient, interaction: ModalSubmitInteraction, characterId: string, messageId: string): Promise<void> {
   if (!isOwner(interaction)) {
      await interaction.reply({ content: 'Only the Imperator passes judgement.', ...ephemeral });
      return;
   }

   const reason = interaction.fields.getTextInputValue('reason').trim();
   const character = await characterService.get(characterId);
   if (!character) {
      await interaction.reply({ content: 'That character no longer exists.', ...ephemeral });
      return;
   }

   if (!await characterService.reject(characterId, reason)) {
      await interaction.reply({ content: 'That petition is no longer pending — it was already decided or has changed since.', ...ephemeral });
      return;
   }

   const decided: CharacterDoc = { ...character, approvalStatus: 'rejected', rejectionReason: reason };

   await editDecreeMessage(interaction, messageId, decided, reason);
   await interaction.reply({ content: `Petition for **${character.identity.name}** rejected.`, ...ephemeral });
   await notifyPlayer(client, character, 'rejected', reason);
}

// --- Helpers ----------------------------------------------------------------

function isOwner(interaction: ButtonInteraction | ModalSubmitInteraction): boolean {
   return interaction.user.id === config.ownerId;
}

/** Fetches a character and verifies the actor owns it and it's still editable, replying (and returning null) otherwise. */
async function ownedEditable(
   interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
   characterId: string,
): Promise<CharacterDoc | null> {
   const character = await characterService.get(characterId);

   if (!character || character.ownerId !== interaction.user.id) {
      await interaction.reply({ content: "That isn't your character.", ...ephemeral });
      return null;
   }
   if (!canEdit(character)) {
      await interaction.reply({ content: "That character can't be changed right now.", ...ephemeral });
      return null;
   }

   return character;
}

/** Repaints the original decree message with the verdict (best-effort). */
async function editDecreeMessage(interaction: ModalSubmitInteraction, messageId: string, character: CharacterDoc, reason: string): Promise<void> {
   if (!interaction.guild || !messageId)
      return;

   const channel = resolveGuildChannel(interaction.guild, settings.channels.imperialDecrees);
   if (!channel?.isSendable())
      return;

   try {
      const message = await channel.messages.fetch(messageId);
      await message.edit({ embeds: [buildDecidedDecree(character, 'rejected', interaction.user.id, reason)], components: [] });
   } catch {
      // The decree message may have been deleted — the ephemeral confirmation is enough.
   }
}

/** DMs the petitioner with the verdict. Silently tolerates closed DMs. */
async function notifyPlayer(client: ToscheClient, character: CharacterDoc, decision: 'approved' | 'rejected', reason?: string): Promise<void> {
   if (!character.ownerId)
      return;

   const text = decision === 'approved'
      ? `✅ Your character **${character.identity.name}** has been recognized by the Imperator. You may now act, soldier.`
      : `❌ Your character **${character.identity.name}** was not recognized.${reason ? ` Reason: ${reason}` : ''}\nOpen it with \`/character edit\` to fix and resubmit.`;

   try {
      const user = await client.users.fetch(character.ownerId);
      await user.send(text);
   } catch {
      // DMs closed — they'll see the result via /character list.
   }
}
