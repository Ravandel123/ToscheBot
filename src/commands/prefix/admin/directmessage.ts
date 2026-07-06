import type { Message, User } from 'discord.js';
import type { PrefixCommand } from '../../../types/commands.js';

// Resolves the DM target: a mention, else a raw user id. (Name lookup isn't
// supported here — DMs need an exact user.)
async function resolveUser(message: Message, ref: string): Promise<User | undefined> {
   const mentioned = message.mentions.users.first();
   if (mentioned)
      return mentioned;

   const id = ref.replace(/\D/g, '');
   if (!id)
      return undefined;

   return message.client.users.fetch(id).catch(() => undefined);
}

export default {
   name: 'directmessage',
   aliases: ['dm'],
   description: 'Sends a DM to a user as the bot.',
   usage: 'dm <user id or @mention> <message>',
   category: 'admin',
   ownerOnly: true,
   async execute(message, args) {
      const [ref, ...rest] = args;
      const content = rest.join(' ').trim();

      if (!ref || !content) {
         await message.reply('Usage: `h!dm <user id or @mention> <message>`');
         return;
      }

      const user = await resolveUser(message, ref);
      if (!user) {
         await message.reply("I can't find that user.");
         return;
      }

      try {
         await user.send(content);
         await message.reply(`📨 Delivered to **${user.username}**.`);
      } catch {
         await message.reply(`I couldn't DM **${user.username}** — their DMs may be closed.`);
      }
   },
} satisfies PrefixCommand;
