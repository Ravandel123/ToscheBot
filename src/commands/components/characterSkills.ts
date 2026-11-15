import type { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { buildSkillOverview, buildSkillTreeView } from './_skillPanel.js';
import { ephemeral } from '../../lib/discord.js';
import { NO_ACTIVE_CHARACTER } from './_characterAction.js';

// Handles `charskills:*` from the `/character skills` viewer (the skill panel):
//   open:<rootId> (select) → that tree's breakdown;
//   overview (button)      → back to the tree list.
// The panel is personal + ephemeral (like `/profile`), so the clicker IS the
// owner — we re-resolve their active character each time rather than trust an id
// in the customId. Read-only: skills grow through play, there's nothing to spend
// here yet, so no lock/mutation is involved.
export default {
   namespace: 'charskills',
   async handle(_client, interaction) {
      const [, action] = interaction.customId.split(':');

      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.reply({ content: NO_ACTIVE_CHARACTER, ...ephemeral });
         return;
      }

      if (interaction.isStringSelectMenu() && action === 'open') {
         await interaction.update(buildSkillTreeView(character, interaction.values[0]));
         return;
      }

      if (interaction.isButton() && action === 'overview')
         await interaction.update(buildSkillOverview(character));
   },
} satisfies ComponentHandler;
