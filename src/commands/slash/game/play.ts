import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { inventoryService } from '../../../db/services/inventoryService.js';
import { activityStepView } from '../../components/_activities/registry.js';
import { BUSY_RIGHT_NOW, NO_ACTIVE_CHARACTER } from '../../components/_characterAction.js';
import { freshHubView } from '../../components/_hubView.js';
import { STARTER_KIT_ENABLED } from '../../../game/data/starterKit.js';
import { ephemeral } from '../../../lib/discord.js';

// The entry point to the server RPG. A single ephemeral hub that shows where
// the active character is, what it can do here, and where it can go: the
// travel menu plus one button per live action at this location. Rendering is
// read-only, so it skips the character lock (every view re-reads the DB); the
// buttons do the mutations under the lock (the `play` component handler).

export default {
   data: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Open the game hub for your active character: travel and act where you are.'),
   category: 'game',
   async execute(client, interaction) {
      if (!interaction.guild) {
         await interaction.reply({ content: 'The game lives on the server, not in DMs.', ...ephemeral });
         return;
      }

      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.reply({ content: NO_ACTIVE_CHARACTER, ...ephemeral });
         return;
      }

      // Busy: mid short action → ask to retry; mid durable activity → re-enter
      // it instead of showing a hub the character can't act from.
      if (client.locks.isLocked(character._id)) {
         await interaction.reply({ content: BUSY_RIGHT_NOW, ...ephemeral });
         return;
      }

      const session = await activitySessionService.getActiveForParticipant(character._id);
      if (session) {
         await interaction.reply({ ...activityStepView(session), ...ephemeral });
         return;
      }

      // First visit of an approved character: issue the starter kit (currently
      // switched off — see starterKit.ts). Ack first: the lock may be taken in
      // the meantime, and the wait could pass the ~3 s window.
      if (STARTER_KIT_ENABLED && character.approvalStatus === 'approved' && !character.starterKitGranted) {
         await interaction.deferReply(ephemeral);
         const issued = await client.locks.runExclusive([character._id], () => inventoryService.issueStarterKit(character._id));
         const banner = issued && issued.length > 0
            ? `🎒 The quartermaster issues your kit: **${issued.join('**, **')}**. Equip it from the Pack.`
            : undefined;
         await interaction.editReply(await freshHubView(character, banner));
         return;
      }

      await interaction.reply({ ...await freshHubView(character), ...ephemeral });
   },
} satisfies SlashCommand;
