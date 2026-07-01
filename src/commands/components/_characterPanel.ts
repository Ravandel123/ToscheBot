// Discord adapter (marked): the interactive character-creation panel. One
// ephemeral message that combines a race dropdown (selects only live on
// messages), an "Edit details" button (free text only lives in a modal), and a
// Submit button. It re-renders in place after each step. Stateless: the
// character id rides in every customId and the state is the DB draft itself, so
// the panel survives restarts (no collector). Underscore prefix → loader skips it.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import { RACES } from '../../game/data/races.js';
import { canEdit } from '../../game/character/rules.js';
import { GENDER_CHOICES, STATUS_LABEL, isHttpUrl, isIdentityComplete } from '../../game/character/identity.js';
import type { CharacterDoc } from '../../db/models/character.js';

const PANEL_COLOR = 0xB8860B; // dark goldenrod — matches the decree

export interface CharacterPanel {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** Builds the creation panel for a character. Editable (draft/rejected) → full controls; otherwise a read-only state card. */
export function buildCharacterPanel(character: CharacterDoc): CharacterPanel {
   const { identity } = character;
   const raceName = identity.race ? RACES[identity.race].name : '—';
   const genderLabel = GENDER_CHOICES.find((g) => g.value === identity.gender)?.label ?? identity.gender ?? '—';

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`🪶 ${identity.name || 'New character'}`)
      .addFields(
         { name: 'Name', value: identity.name || '—', inline: true },
         { name: 'Epithet', value: identity.epithet || '—', inline: true },
         { name: 'Race', value: raceName, inline: true },
         { name: 'Gender', value: genderLabel || '—', inline: true },
         { name: 'Description', value: identity.bio || '—' },
      );

   if (isHttpUrl(identity.avatarUrl))
      embed.setThumbnail(identity.avatarUrl);

   if (!canEdit(character)) {
      const note = character.approvalStatus === 'rejected' && character.rejectionReason
         ? `${STATUS_LABEL.rejected} — ${character.rejectionReason}`
         : STATUS_LABEL[character.approvalStatus];
      return { embeds: [embed.setDescription(note)], components: [] };
   }

   const complete = isIdentityComplete(identity);
   const checklist = `${identity.name.trim().length >= 2 ? '✅' : '⬜'} Name   ${identity.race ? '✅' : '⬜'} Race`;
   // A rejected character is editable again — show why, so the player can fix it.
   const rejectedNote = character.approvalStatus === 'rejected' && character.rejectionReason
      ? `❌ **Previously rejected:** ${character.rejectionReason}\n\n`
      : '';
   embed.setDescription(
      rejectedNote + (complete
         ? `${checklist}\n✅ Ready — press **Submit for approval**.`
         : `${checklist}\nPick a race and gender below, **Edit details**, then submit.`),
   );

   return { embeds: [embed], components: [raceRow(character), genderRow(character), buttonRow(character, complete)] };
}

function raceRow(character: CharacterDoc): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`character:panel-race:${character._id}`)
      .setPlaceholder(character.identity.race ? `Race: ${RACES[character.identity.race].name}` : 'Choose a race')
      .addOptions(
         Object.entries(RACES).map(([id, def]) => ({
            label: def.name,
            value: id,
            description: def.description.slice(0, 100),
            default: id === character.identity.race,
         })),
      );

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function genderRow(character: CharacterDoc): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const current = GENDER_CHOICES.find((g) => g.value === character.identity.gender);
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`character:panel-gender:${character._id}`)
      .setPlaceholder(current ? `Gender: ${current.label}` : 'Choose a gender')
      .addOptions(GENDER_CHOICES.map((g) => ({ label: g.label, value: g.value, default: g.value === character.identity.gender })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function buttonRow(character: CharacterDoc, complete: boolean): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`character:panel-edit:${character._id}`).setLabel('Edit details').setEmoji('✏️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`character:panel-submit:${character._id}`).setLabel('Submit for approval').setEmoji('📜').setStyle(ButtonStyle.Success).setDisabled(!complete),
   );
}
