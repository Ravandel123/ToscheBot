// Discord adapter (marked): builds the approval-petition embed + buttons that go
// to the owner-only Imperial Decrees channel, and the "decided" version shown
// after the verdict. Pure presentation — no DB, no side effects.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { RACES } from '../../game/data/races.js';
import { displayName, isHttpUrl } from '../../game/character/identity.js';
import type { CharacterDoc } from '../../db/models/character.js';

const PENDING_COLOR = 0xB8860B; // dark goldenrod — an awaiting decree
const APPROVED_COLOR = 0x2E8B57; // sea green
const REJECTED_COLOR = 0x8B0000; // dark red

function raceName(character: CharacterDoc): string {
   return character.identity.race ? RACES[character.identity.race].name : 'Unknown';
}

function petitionFields(character: CharacterDoc): { name: string; value: string; inline?: boolean }[] {
   return [
      { name: 'Name', value: character.identity.name, inline: true },
      { name: 'Epithet', value: character.identity.epithet || '—', inline: true },
      { name: 'Race', value: raceName(character), inline: true },
      { name: 'Gender', value: character.identity.gender || '—', inline: true },
      { name: 'Petitioner', value: character.ownerId ? `<@${character.ownerId}>` : 'NPC', inline: true },
      { name: 'Description', value: character.identity.bio || '_No description provided._' },
   ];
}

/** The pending petition the owner sees, with Approve/Reject buttons. */
export function buildDecreeEmbed(character: CharacterDoc): EmbedBuilder {
   const embed = new EmbedBuilder()
      .setTitle(`📜 Petition for Recognition — ${displayName(character)}`)
      .setColor(PENDING_COLOR)
      .addFields(petitionFields(character))
      .setFooter({ text: `Character ${character._id}` })
      .setTimestamp();

   if (isHttpUrl(character.identity.avatarUrl))
      embed.setThumbnail(character.identity.avatarUrl);

   return embed;
}

export function buildDecreeButtons(characterId: string): ActionRowBuilder<ButtonBuilder> {
   return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`character:approve:${characterId}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`character:reject:${characterId}`).setLabel('Reject').setStyle(ButtonStyle.Danger).setEmoji('❌'),
   );
}

/** The same petition after a verdict — recoloured, with the decision, buttons removed. */
export function buildDecidedDecree(
   character: CharacterDoc,
   decision: 'approved' | 'rejected',
   deciderId: string,
   reason?: string,
): EmbedBuilder {
   const embed = new EmbedBuilder()
      .addFields(petitionFields(character))
      .setFooter({ text: `Character ${character._id}` })
      .setTimestamp();

   if (isHttpUrl(character.identity.avatarUrl))
      embed.setThumbnail(character.identity.avatarUrl);

   if (decision === 'approved')
      return embed
         .setTitle(`✅ Recognized — ${displayName(character)}`)
         .setColor(APPROVED_COLOR)
         .addFields({ name: 'Verdict', value: `Approved by <@${deciderId}>.` });

   return embed
      .setTitle(`❌ Rejected — ${displayName(character)}`)
      .setColor(REJECTED_COLOR)
      .addFields(
         { name: 'Verdict', value: `Rejected by <@${deciderId}>.` },
         { name: 'Reason', value: reason || '—' },
      );
}
