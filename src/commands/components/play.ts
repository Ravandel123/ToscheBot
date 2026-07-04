import { MessageFlags } from 'discord.js';
import { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { hubAction } from '../../game/data/hubActions.js';
import { performTravel } from './_playPanel.js';

// Handles the `/play` game hub (namespace `play`). The hub is ephemeral and
// personal, so the clicker is always the active-character owner (like the
// account panel). Two actions today:
//   * `play:travel`  — a destination select; mutates state (spend AP, move,
//     maybe start a challenge), so it follows the D28 mutation choreography:
//     fast-fail if in-memory locked → deferUpdate → runExclusive (in
//     performTravel) → repaint;
//   * `play:act:<id>` — a location action; every one is a PLACEHOLDER for now,
//     so it just pops an in-character "coming soon" note and leaves the hub up.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export default {
   namespace: 'play',
   async handle(client, interaction) {
      const [, action, ...args] = interaction.customId.split(':');

      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.reply({ content: 'You have no active character. Draft one with `/character create`.', ...ephemeral });
         return;
      }

      if (action === 'travel' && interaction.isStringSelectMenu()) {
         if (client.locks.isLocked(character._id)) {
            await interaction.reply({ content: 'Your character is mid-activity — finish it first.', ...ephemeral });
            return;
         }

         // Ack before the lock: the character may be queued behind a long fight,
         // and an interaction only waits ~3 s for its first response.
         await interaction.deferUpdate();
         await performTravel(client, interaction, character, interaction.values[0]);
         return;
      }

      if (action === 'act') {
         const local = hubAction(args[0] ?? '');
         await interaction.reply({
            content: local ? `${local.emoji} ${local.comingSoon} _(coming soon)_` : 'That action is no longer here.',
            ...ephemeral,
         });
         return;
      }

      // A component from an older hub whose action is gone — ignore quietly.
      await interaction.reply({ content: 'That option is no longer available. Open a fresh `/play`.', ...ephemeral });
   },
} satisfies ComponentHandler;
