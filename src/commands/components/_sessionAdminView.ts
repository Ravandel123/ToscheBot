// The owner's overview of every active activity session (`h!session`, D58).
// Sessions never expire, so this is the one way to free a character whose
// activity got stuck. Read-only render; the `session` component ends one.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { displayName } from '../../game/character/identity.js';
import { truncate } from '../../lib/text.js';
import { activityTitle } from './_activities/registry.js';
import type { ActivitySessionDoc } from '../../db/models/activitySession.js';

const SESSION_COLOR = 0x5A6B7A; // ledger slate
/** A select menu holds 25 options — more than the server will ever have open. */
const MAX_LISTED = 25;

export interface SessionOverview {
   content: string;
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** Who is in a session, as "Name (<@owner>)" — NPCs and deleted characters degrade to text. */
export async function sessionParticipants(session: ActivitySessionDoc): Promise<string> {
   const characters = await Promise.all(session.participantIds.map((id) => characterService.get(id)));

   return characters
      .map((character, index) => {
         if (!character)
            return `unknown character \`${session.participantIds[index]}\``;
         return character.ownerId ? `**${displayName(character)}** (<@${character.ownerId}>)` : `**${displayName(character)}**`;
      })
      .join(', ');
}

export async function buildSessionOverview(note = ''): Promise<SessionOverview> {
   const sessions = (await activitySessionService.listActive()).slice(0, MAX_LISTED);
   const refresh = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId('session:refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
   );

   if (sessions.length === 0) {
      const embed = new EmbedBuilder()
         .setColor(SESSION_COLOR)
         .setTitle('📋 Active sessions')
         .setDescription('Nobody is in the middle of anything.');
      return { content: note, embeds: [embed], components: [refresh] };
   }

   const who = await Promise.all(sessions.map(sessionParticipants));
   const lines = sessions.map((session, index) =>
      `**${index + 1}.** ${who[index]} — ${activityTitle(session)} · step ${session.step} · opened <t:${Math.floor(session.createdAt.getTime() / 1000)}:R>`);

   const embed = new EmbedBuilder()
      .setColor(SESSION_COLOR)
      .setTitle('📋 Active sessions')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Ending a session frees the character with no consequence. It cannot be undone.' });

   const select = new StringSelectMenuBuilder()
      .setCustomId('session:end')
      .setPlaceholder('End a session…')
      .addOptions(sessions.map((session, index) => ({
         label: truncate(`${index + 1}. ${activityTitle(session)}`, 100),
         value: session._id,
      })));

   return {
      content: note,
      embeds: [embed],
      components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select), refresh],
   };
}
