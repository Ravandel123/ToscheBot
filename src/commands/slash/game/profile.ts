import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { RESOURCES } from '../../../game/data/resources.js';
import { CURRENCIES } from '../../../game/data/currencies.js';
import { RACES } from '../../../game/data/races.js';
import { locationName } from '../../../game/data/locations.js';
import { displayName, isHttpUrl, STATUS_LABEL } from '../../../game/character/identity.js';
import type { CharacterDoc } from '../../../db/models/character.js';

function buildEmbed(character: CharacterDoc): EmbedBuilder {
   const resources = Object.entries(RESOURCES)
      .map(([key, def]) => {
         const state = character.resources[key as keyof typeof RESOURCES];
         return `**${def.name}:** ${state.current}/${state.max}`;
      })
      .join('\n');

   const currencies = Object.entries(CURRENCIES)
      .map(([key, def]) => `${def.emoji} **${def.name}:** ${character.currencies[key as keyof typeof CURRENCIES]}`)
      .join('\n');

   const race = character.identity.race ? RACES[character.identity.race].name : 'Unknown';

   const embed = new EmbedBuilder()
      .setTitle(displayName(character))
      .setDescription(`${STATUS_LABEL[character.approvalStatus]} · ${race} · 📍 ${locationName(character.locationId)}`)
      .addFields(
         { name: 'Action Points', value: `${character.actionPoints.current}`, inline: false },
         { name: 'Vitals', value: resources, inline: true },
         { name: 'Currencies', value: currencies, inline: true },
      );

   if (isHttpUrl(character.identity.avatarUrl))
      embed.setThumbnail(character.identity.avatarUrl);

   return embed;
}

export default {
   data: new SlashCommandBuilder()
      .setName('profile')
      .setDescription("Shows a player's active character.")
      .addUserOption((option) =>
         option.setName('user').setDescription('Whose character to show (defaults to you).'),
      ),
   category: 'game',
   async execute(_client, interaction) {
      const target = interaction.options.getUser('user') ?? interaction.user;

      if (target.bot) {
         await interaction.reply('Machines do not enlist. They serve, yes-yes.');
         return;
      }

      // Viewing yourself onboards you (account + starter draft); viewing someone
      // else is a pure read — a lookup must not create documents for the target.
      const character = target.id === interaction.user.id
         ? await accountService.getActiveCharacter(target.id, target.displayName)
         : await accountService.peekActiveCharacter(target.id);

      if (!character) {
         await interaction.reply(`${target.displayName} has no active character.`);
         return;
      }

      await interaction.reply({ embeds: [buildEmbed(character)] });
   },
} satisfies SlashCommand;
