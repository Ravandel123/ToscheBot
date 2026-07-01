import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { smackdownService } from '../../../db/services/smackdownService.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export default {
   data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Top fighters of the Smackdown Spire by ELO.'),
   category: 'game',
   async execute(_client, interaction) {
      const records = await smackdownService.getLeaderboard(10);

      if (records.length === 0) {
         await interaction.reply('No one has fought in the Spire yet. Be the first — `/smackdown`.');
         return;
      }

      const lines = records.map((record, i) => {
         const rank = MEDALS[i] ?? `**${i + 1}.**`;
         return `${rank} **${record.characterName}** — **${record.eloRating}** ELO (${record.wins}W / ${record.losses}L)`;
      });

      const embed = new EmbedBuilder()
         .setTitle('⚔️ Smackdown Spire — Leaderboard')
         .setDescription(lines.join('\n'));

      await interaction.reply({ embeds: [embed] });
   },
} satisfies SlashCommand;
