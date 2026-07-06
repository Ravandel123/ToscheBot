import { EmbedBuilder } from 'discord.js';
import type { PrefixCommand, PrefixCategory } from '../../../types/commands.js';
import type { ToscheClient } from '../../../client.js';
import { config } from '../../../config.js';
import { botClient } from '../../../lib/discord.js';

const IMPERIAL_GOLD = 0xc0a062;

// Order + headings for the overview. Admin is only shown to the owner.
const CATEGORY_TITLES: Record<PrefixCategory, string> = {
   fun: '🎲 Fun',
   utility: '🛠️ Utility',
   admin: '👑 Admin (Imperator only)',
};

// Renders a full usage example. The `usage` strings are inconsistent — some already
// start with the command name ("avatar [@user]"), some are just the trailing phrase
// ("are an awesome general"). Prefix the name only when it isn't there already.
function usageLine(command: PrefixCommand): string {
   const prefix = config.prefix;
   if (!command.usage)
      return `${prefix}${command.name}`;

   const startsWithName = command.usage.toLowerCase().startsWith(command.name.toLowerCase());
   return startsWithName ? `${prefix}${command.usage}` : `${prefix}${command.name} ${command.usage}`;
}

function uniqueCommands(client: ToscheClient): PrefixCommand[] {
   // The collection is keyed by primary name; aliases live elsewhere, so values() are unique.
   return [...client.prefixCommands.values()];
}

function overviewEmbed(client: ToscheClient, isOwner: boolean): EmbedBuilder {
   const commands = uniqueCommands(client);
   const embed = new EmbedBuilder()
      .setColor(IMPERIAL_GOLD)
      .setTitle("Tosche's orders")
      .setDescription(
         `Prefix commands start with \`${config.prefix}\`. Use \`${config.prefix}help <command>\` for details on one.`,
      );

   for (const category of Object.keys(CATEGORY_TITLES) as PrefixCategory[]) {
      if (category === 'admin' && !isOwner)
         continue;

      const names = commands
         .filter((c) => c.category === category)
         .map((c) => c.name)
         .sort((a, b) => a.localeCompare(b));

      if (names.length > 0)
         embed.addFields({ name: CATEGORY_TITLES[category], value: names.map((n) => `\`${n}\``).join(', ') });
   }

   const slash = [...client.slashCommands.values()]
      .filter((c) => !c.ownerOnly || isOwner)
      .map((c) => c.data.name)
      .sort((a, b) => a.localeCompare(b));

   if (slash.length > 0)
      embed.addFields({ name: '⚔️ Game (slash)', value: slash.map((n) => `\`/${n}\``).join(', ') });

   return embed;
}

function detailEmbed(command: PrefixCommand): EmbedBuilder {
   const embed = new EmbedBuilder()
      .setColor(IMPERIAL_GOLD)
      .setTitle(`${config.prefix}${command.name}`)
      .setDescription(command.description)
      .addFields({ name: 'Usage', value: `\`${usageLine(command)}\`` });

   if (command.aliases?.length)
      embed.addFields({ name: 'Aliases', value: command.aliases.map((a) => `\`${a}\``).join(', ') });

   const notes: string[] = [];
   if (command.ownerOnly)
      notes.push('Imperator only');
   if (command.cooldownSeconds)
      notes.push(`${command.cooldownSeconds}s cooldown`);
   if (notes.length > 0)
      embed.setFooter({ text: notes.join(' · ') });

   return embed;
}

export default {
   name: 'help',
   aliases: ['commands'],
   description: 'Lists my commands, or explains one of them.',
   usage: 'help [command]',
   category: 'utility',
   async execute(message, args) {
      const client = botClient(message);
      const isOwner = message.author.id === config.ownerId;

      const query = args[0]?.toLowerCase();
      if (query) {
         const command = client.resolvePrefixCommand(query);

         // Hide admin commands from non-owners even when asked by exact name.
         if (!command || (command.ownerOnly && !isOwner)) {
            await message.reply(`I have no command called \`${query}\`. Try \`${config.prefix}help\`.`);
            return;
         }

         await message.reply({ embeds: [detailEmbed(command)] });
         return;
      }

      await message.reply({ embeds: [overviewEmbed(client, isOwner)] });
   },
} satisfies PrefixCommand;
