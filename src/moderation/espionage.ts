import { EmbedBuilder, type Guild, type Message } from 'discord.js';
import { settings } from '../settings.js';
import { resolveGuildChannel } from '../lib/discord.js';
import { log } from '../lib/log.js';
import type { BannedMatch } from './bannedWords.js';

// Shows the matched term in its surrounding context, underlined+bold, e.g.
// "…check out furaffi…__**nity.net**__/art…" — so the removal is explainable.
function highlightMatch(content: string, match: BannedMatch, pad = 30): string {
   const start = Math.max(0, match.index - pad);
   const end = Math.min(content.length, match.index + match.matchedText.length + pad);
   const lead = (start > 0 ? '…' : '') + content.slice(start, match.index);
   const tail = content.slice(match.index + match.matchedText.length, end) + (end < content.length ? '…' : '');
   return `${lead}__**${match.matchedText}**__${tail}`;
}

/** Posts an embed to the configured #espionage channel, if it exists. */
export async function reportToEspionage(guild: Guild, embed: EmbedBuilder): Promise<void> {
   const channel = resolveGuildChannel(guild, settings.channels.espionage);

   if (channel?.isSendable())
      await channel.send({ embeds: [embed] });
   else
      log.warn(`Espionage channel '${settings.channels.espionage}' not found or not sendable.`);
}

/** Deletes a message that tripped the banned-word filter and reports exactly what
 *  matched and where, so a removal is never a mystery. */
export async function handleBannedMessage(message: Message, match: BannedMatch): Promise<void> {
   await message.delete().catch(() => undefined);

   if (!message.inGuild())
      return;

   const where = `||${highlightMatch(message.content, match)}||`.slice(0, 1024);

   const embed = new EmbedBuilder()
      .setTitle('🚫 Forbidden word removed')
      .setColor(0xcc3333)
      .addFields(
         { name: 'Author', value: `<@${message.author.id}>`, inline: true },
         { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
         { name: 'Blocked term', value: `||${match.term}||`, inline: true },
         { name: 'Where it matched', value: where },
      )
      .setTimestamp();

   if (match.viaCollapsed)
      embed.addFields({
         name: 'Note',
         value: 'Matched only after ignoring spaces/punctuation — e.g. inside a link or spaced out. This can be a false positive.',
      });

   await reportToEspionage(message.guild, embed);
}

/** Logs an administrative action (e.g. a bulk clear) to #espionage. */
export async function reportAdminAction(guild: Guild, description: string): Promise<void> {
   const embed = new EmbedBuilder()
      .setTitle('🛡️ Admin action')
      .setColor(0x3366cc)
      .setDescription(description)
      .setTimestamp();

   await reportToEspionage(guild, embed);
}
