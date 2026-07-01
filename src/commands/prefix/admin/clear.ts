import { PrefixCommand } from '../../../types/commands.js';
import { reportAdminAction } from '../../../moderation/espionage.js';

export default {
   name: 'clear',
   aliases: ['clean'],
   description: 'Deletes up to 100 recent messages from this channel.',
   usage: '<amount 1-100>',
   category: 'admin',
   ownerOnly: true,
   async execute(message, args) {
      const amount = Number(args[0]);

      if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
         await message.reply('Give me a number between 1 and 100.');
         return;
      }

      if (!message.inGuild())
         return;

      // Remove the invoking message first, so it doesn't eat into the requested
      // count. `true` skips messages older than 14 days (Discord won't bulk-delete those).
      await message.delete().catch(() => undefined);
      const deleted = await message.channel.bulkDelete(amount, true);
      await reportAdminAction(message.guild, `<@${message.author.id}> cleared **${deleted.size}** messages in <#${message.channelId}>.`);
   },
} satisfies PrefixCommand;
