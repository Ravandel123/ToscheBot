import { EmbedBuilder, type Message } from 'discord.js';
import { defineEvent } from '../types/events.js';
import { config } from '../config.js';
import { findBannedWord } from '../moderation/bannedWords.js';
import { handleBannedMessage, reportToEspionage } from '../moderation/espionage.js';

// Edit log: report edited messages to #espionage AND re-run the banned-word check
// on the new content (so someone can't edit a clean message into a forbidden one).
export default defineEvent({
   name: 'messageUpdate',
   async execute(_client, oldMessage, newMessage) {
      if (newMessage.guildId !== config.guildId)
         return;

      // The new message may be partial (uncached) — fetch the full version so we can
      // read its content and moderate it.
      let message: Message;
      try {
         message = newMessage.partial ? await newMessage.fetch() : newMessage;
      } catch {
         return; // edited message vanished before we could read it
      }

      if (message.author.bot || !message.guild)
         return;
      if (oldMessage.content === message.content)
         return; // no text change (e.g. a link unfurling into an embed)

      // Moderate the edited text exactly like a fresh message (owner exempt).
      if (message.author.id !== config.ownerId) {
         const banned = findBannedWord(message.content);
         if (banned) {
            await handleBannedMessage(message, banned);
            return;
         }
      }

      const embed = new EmbedBuilder()
         .setTitle('✏️ Message edited')
         .setColor(0xddaa33)
         .addFields(
            { name: 'Author', value: `<@${message.author.id}>`, inline: true },
            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
            { name: 'Before', value: oldMessage.content?.slice(0, 1024) || '*(no cached content)*' },
            { name: 'After', value: message.content.slice(0, 1024) || '*(empty)*' },
         )
         .setTimestamp();

      await reportToEspionage(message.guild, embed);
   },
});
