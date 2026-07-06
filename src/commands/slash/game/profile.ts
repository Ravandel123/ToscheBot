import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { fetchProfilePanel } from '../../components/_profilePanel.js';

// The ACCOUNT surface (D27): your Discord-user-level state — active character
// pointer, character count, and toggleable settings (game events, DMs).
// Character sheets live under `/character view`.
export default {
   data: new SlashCommandBuilder()
      .setName('profile')
      .setDescription('Your account: active character and settings.'),
   category: 'game',
   async execute(_client, interaction) {
      await interaction.reply({
         ...await fetchProfilePanel(interaction.user.id, interaction.user.displayName),
         flags: MessageFlags.Ephemeral,
      });
   },
} satisfies SlashCommand;
