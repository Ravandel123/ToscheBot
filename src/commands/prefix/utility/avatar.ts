import { EmbedBuilder, type Message, type User } from 'discord.js';
import { PrefixCommand } from '../../../types/commands.js';

// Resolves who the avatar is for: a mention, else a name/nick match in this guild,
// else (no arg) the author. Returns undefined only when a name was given but missed.
function resolveTarget(message: Message, query: string | undefined): User | undefined {
   const mentioned = message.mentions.users.first();
   if (mentioned)
      return mentioned;

   if (!query)
      return message.author;

   const needle = query.toLowerCase();
   const member = message.guild?.members.cache.find(
      (m) => m.user.username.toLowerCase() === needle || m.displayName.toLowerCase() === needle,
   );
   return member?.user;
}

export default {
   name: 'avatar',
   aliases: ['pfp'],
   description: "Shows a user's avatar.",
   usage: 'avatar [@user or name]',
   category: 'utility',
   async execute(message, args) {
      const target = resolveTarget(message, args[0]);

      if (!target) {
         await message.reply(`I can't find anyone called "${args.join(' ')}" here.`);
         return;
      }

      // Prefer the server-specific avatar (member) over the global one (user).
      const member = message.guild?.members.cache.get(target.id);
      const url = (member ?? target).displayAvatarURL({ size: 1024 });

      const embed = new EmbedBuilder()
         .setTitle(`${member?.displayName ?? target.username}'s avatar`)
         .setImage(url)
         .setURL(url);

      await message.reply({ embeds: [embed] });
   },
} satisfies PrefixCommand;
