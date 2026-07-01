import { PrefixCommand } from '../../../types/commands.js';
import { resolveGuildChannel } from '../../../lib/discord.js';

export default {
   name: 'messagechannel',
   aliases: ['mc'],
   description: 'Posts a message to a channel as the bot.',
   usage: 'mc <channel id, #mention, or name> <message>',
   category: 'admin',
   ownerOnly: true,
   async execute(message, args) {
      const [ref, ...rest] = args;
      const content = rest.join(' ').trim();

      if (!ref || !content) {
         await message.reply('Usage: `h!mc <channel id, #mention, or name> <message>`');
         return;
      }

      if (!message.inGuild())
         return;

      // Accept a #channel mention as well as an id/name (resolveGuildChannel handles the rest).
      const channelRef = ref.replace(/^<#(\d+)>$/, '$1');
      const channel = resolveGuildChannel(message.guild, channelRef);

      if (!channel?.isSendable()) {
         await message.reply("I can't find a channel I can post to by that reference.");
         return;
      }

      await channel.send(content);
      await message.reply(`📨 Posted to <#${channel.id}>.`);
   },
} satisfies PrefixCommand;
