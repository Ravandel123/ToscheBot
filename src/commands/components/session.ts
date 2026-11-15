import type { ComponentHandler } from '../../types/interactions.js';
import { config } from '../../config.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { activityTitle } from './_activities/registry.js';
import { buildSessionOverview, sessionParticipants } from './_sessionAdminView.js';
import { ephemeral } from '../../lib/discord.js';

// Routes the owner's `h!session` panel: `session:refresh` repaints the
// overview, `session:end` (select, value = session id) removes one session.
// Ending is a plain delete — none of the activity's exit consequences apply,
// because this is the owner unsticking a character, not the player leaving.
// The message is public, so every click re-checks that the owner pressed it.
export default {
   namespace: 'session',
   async handle(_client, interaction) {
      if (interaction.user.id !== config.ownerId) {
         await interaction.reply({ content: 'Only the Imperator clears the ledger.', ...ephemeral });
         return;
      }

      const [, action] = interaction.customId.split(':');

      if (interaction.isButton() && action === 'refresh') {
         await interaction.update(await buildSessionOverview());
         return;
      }

      if (interaction.isStringSelectMenu() && action === 'end') {
         const session = await activitySessionService.get(interaction.values[0]);
         const note = session && await activitySessionService.abandon(session._id)
            ? `🧹 Ended: ${await sessionParticipants(session)} — ${activityTitle(session)}.`
            : 'That session was already gone.';

         await interaction.update(await buildSessionOverview(note));
      }
   },
} satisfies ComponentHandler;
