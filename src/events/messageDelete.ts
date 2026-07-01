import { AuditLogEvent, EmbedBuilder, PermissionFlagsBits, type Message, type PartialMessage } from 'discord.js';
import { defineEvent } from '../types/events.js';
import { config } from '../config.js';
import { reportToEspionage } from '../moderation/espionage.js';

// Best-effort "who deleted this": Discord only audit-logs deletions done by someone
// OTHER than the author, the entries are reused/fuzzy (a stale timestamp on repeat
// deletes), and it needs View Audit Log. So this is a hint, not proof — we only
// claim a deleter when we find a fresh, matching entry. Returns the executor's id.
async function findDeleterId(message: Message | PartialMessage): Promise<string | null> {
   if (!message.guild || !message.author)
      return null;

   const me = message.guild.members.me;
   if (!me?.permissions.has(PermissionFlagsBits.ViewAuditLog))
      return null;

   try {
      const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 });
      const entry = logs.entries.find((e) =>
         e.target?.id === message.author?.id
         && e.extra?.channel?.id === message.channelId
         && Date.now() - e.createdTimestamp < 5000,
      );

      return entry?.executor?.id ?? null;
   } catch {
      return null;
   }
}

// Snipe log: report deleted messages to #espionage. A deleted message is often a
// PartialMessage (uncached), so content/author may be missing — we log what we have.
export default defineEvent({
   name: 'messageDelete',
   async execute(_client, message) {
      if (message.guildId !== config.guildId || !message.guild)
         return;
      if (message.author?.bot)
         return;

      const embed = new EmbedBuilder()
         .setTitle('🗑️ Message deleted')
         .setColor(0x9b59b6)
         .addFields(
            { name: 'Author', value: message.author ? `<@${message.author.id}>` : 'Unknown (uncached)', inline: true },
            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
            { name: 'Content', value: message.content?.slice(0, 1024) || '*(no cached content)*' },
         )
         .setTimestamp();

      if (message.attachments.size > 0)
         embed.addFields({
            name: `Attachments (${message.attachments.size})`,
            value: message.attachments.map((a) => `[${a.name}](${a.url})`).join('\n').slice(0, 1024),
         });

      const deleterId = await findDeleterId(message);
      if (deleterId && deleterId !== message.author?.id)
         embed.addFields({ name: 'Deleted by', value: `<@${deleterId}> (not the author)` });

      await reportToEspionage(message.guild, embed);
   },
});
