import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { buildInventoryHub } from '../../components/_inventoryPanel.js';

// The inventory panel (D28): equipment overview + category browser for the
// ACTIVE character. Ephemeral — your pack is your business (D24); the panel's
// buttons re-read everything from the DB, so it survives restarts and never
// acts on stale contents. Works for drafts too: gearing up is sheet-building,
// not a character ACTION, so it is deliberately not behind canCharacterAct.
export default {
   data: new SlashCommandBuilder()
      .setName('inventory')
      .setDescription('Open your active character\'s pack and equipment.'),
   category: 'game',
   async execute(_client, interaction) {
      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.reply({ content: 'You have no active character. Draft one with `/character create`.', flags: MessageFlags.Ephemeral });
         return;
      }

      await interaction.reply({ ...buildInventoryHub(character), flags: MessageFlags.Ephemeral });
   },
} satisfies SlashCommand;
