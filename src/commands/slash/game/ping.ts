import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';

export default {
   data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Checks whether Tosch is awake.'),
   category: 'game',
   async execute(_client, interaction) {
      await interaction.reply(`Awake and watching. Gateway ping: ${interaction.client.ws.ping}ms.`);
   },
} satisfies SlashCommand;
