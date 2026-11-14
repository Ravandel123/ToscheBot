import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { inventoryService } from '../../../db/services/inventoryService.js';
import { busyNote } from '../../components/_activities/registry.js';
import { sessionStepView } from '../../components/_playPanel.js';
import { freshHubView } from '../../components/_hubView.js';
import { STARTER_KIT_ENABLED } from '../../../game/data/starterKit.js';

// The default entry point to the server RPG (D1). A single ephemeral hub that
// shows where the active character is, what it can do here, and where it can
// go: the travel menu plus one button per live action at this location. Rendering
// is read-only, so it skips the character lock (staleness self-heals — every
// view re-reads the DB); the travel button does the actual mutation under the
// lock (see the `play` component handler).
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

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
         await interaction.reply({ content: 'You have no active character. Draft one with `/character create`.', ...ephemeral });
         return;
      }

      // Busy: mid short action → ask to retry; mid durable activity → re-enter
      // it (D22) instead of showing a hub the character can't act from.
      if (client.locks.isLocked(character._id)) {
         await interaction.reply({ content: 'Your character is busy right now — try again in a moment.', ...ephemeral });
         return;
      }

      const session = await activitySessionService.getActiveForParticipant(character._id);
      const step = session ? sessionStepView(session, busyNote(session)) : null;
      if (step) {
         await interaction.reply({ ...step, ...ephemeral });
         return;
      }

      // First visit of an approved character: issue the starter kit (currently
      // switched off — see starterKit.ts). The lock was free a moment ago, so
      // this stays well inside the ack window.
      if (STARTER_KIT_ENABLED && character.approvalStatus === 'approved' && !character.starterKitGranted) {
         const issued = await client.locks.runExclusive([character._id], () => inventoryService.issueStarterKit(character._id));
         if (issued && issued.length > 0) {
            const banner = `🎒 The quartermaster issues your kit: **${issued.join('**, **')}**. Equip it from \`/inventory\`.`;
            await interaction.reply({ ...await freshHubView(character, banner), ...ephemeral });
            return;
         }
      }

      await interaction.reply({ ...await freshHubView(character), ...ephemeral });
   },
} satisfies SlashCommand;
