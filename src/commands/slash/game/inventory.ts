import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { buildInventoryHub } from '../../components/_inventoryPanel.js';
import { ephemeral } from '../../../lib/discord.js';
import { NO_ACTIVE_CHARACTER } from '../../components/_characterAction.js';

// The inventory panel: equipment overview + category browser for the
// ACTIVE character. Ephemeral — your pack is your business; the panel's
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
         await interaction.reply({ content: NO_ACTIVE_CHARACTER, ...ephemeral });
         return;
      }

      await interaction.reply({ ...buildInventoryHub(character), ...ephemeral });
   },
} satisfies SlashCommand;
