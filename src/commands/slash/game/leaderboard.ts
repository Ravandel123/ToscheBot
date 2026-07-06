import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { smackdownService } from '../../../db/services/smackdownService.js';
import { DEFAULT_LEADERBOARD_CATEGORY, LEADERBOARD_CATEGORY_IDS, leaderboardCategory } from '../../../game/combat/leaderboards.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export default {
   data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Top fighters of the Smackdown Spire.')
      .addStringOption((option) => {
         option.setName('category').setDescription('Which board to show (default: ranking).');
         for (const id of LEADERBOARD_CATEGORY_IDS) {
            const category = leaderboardCategory(id);
            option.addChoices({ name: `${category.emoji} ${category.name}`, value: id });
         }
         return option;
      }),
   category: 'game',
   async execute(_client, interaction) {
      const category = leaderboardCategory(interaction.options.getString('category') ?? DEFAULT_LEADERBOARD_CATEGORY);
      const records = await smackdownService.getLeaderboard(category.sortField, 10);

      if (records.length === 0) {
         await interaction.reply('No one has fought in the Spire yet. Be the first — `/smackdown`.');
         return;
      }

      const lines = records.map((record, i) => {
         const rank = MEDALS[i] ?? `**${i + 1}.**`;
         return `${rank} **${record.characterName}** — ${category.format(record)}`;
      });

      const embed = new EmbedBuilder()
         .setTitle(`${category.emoji} Smackdown Spire — ${category.name}`)
         .setDescription(lines.join('\n'));

      await interaction.reply({ embeds: [embed] });
   },
} satisfies SlashCommand;
