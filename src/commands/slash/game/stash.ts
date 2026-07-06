import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { itemService } from '../../../db/services/itemService.js';
import { DEFAULT_CONTAINER } from '../../../game/data/containers.js';
import { buildStashHub } from '../../components/_stashPanel.js';

// The stash panel (D33): browse + withdraw the ACTIVE character's stored items —
// the owned-but-not-carried half of the two-tier item model, living in its own
// `Item` collection so a hoard never taxes a normal character read. Deposit is
// the 🗄️ Store button in `/inventory`; this command is the retrieval side.
// Ephemeral (your chest is your business, D24); buttons re-read from the DB, so
// it survives restarts and never acts on stale contents. Works for drafts too —
// managing storage is sheet-building, not a character ACTION (canCharacterAct
// untouched, same stance as `/inventory`).
export default {
   data: new SlashCommandBuilder()
      .setName('stash')
      .setDescription('Open your active character\'s stash (stored items).'),
   category: 'game',
   async execute(_client, interaction) {
      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.reply({ content: 'You have no active character. Draft one with `/character create`.', flags: MessageFlags.Ephemeral });
         return;
      }

      const counts = await itemService.countByKind(character._id, DEFAULT_CONTAINER);
      await interaction.reply({ ...buildStashHub(character, DEFAULT_CONTAINER, counts), flags: MessageFlags.Ephemeral });
   },
} satisfies SlashCommand;
