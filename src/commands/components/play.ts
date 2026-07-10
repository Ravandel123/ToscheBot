import { MessageFlags } from 'discord.js';
import type { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { locationStateService } from '../../db/services/locationStateService.js';
import { actionsAt, hubAction } from '../../game/data/hubActions.js';
import { resolveLocationId } from '../../game/data/locations.js';
import { evaluateCondition, worldContext } from '../../game/world/conditions.js';
import { performForage } from './_forageAction.js';
import { performTalk, showTalkPicker } from './_talkAction.js';
import { freshHubView } from './_hubView.js';
import { performTravel } from './_playPanel.js';

// Handles the `/play` game hub (namespace `play`). The hub is ephemeral and
// personal, so the clicker is always the active-character owner (like the
// account panel). Two actions today:
//   * `play:travel`  — a destination select; mutates state (spend AP, move,
//     maybe start a challenge), so it follows the D28 mutation choreography:
//     fast-fail if in-memory locked → deferUpdate → runExclusive (in
//     performTravel) → repaint;
//   * `play:act:<id>` — a location action; still PLACEHOLDERS, but location
//     and availability (D31) are re-checked at CLICK time — a hub message can
//     outlive a move, a nightfall or an event's end (stale panels).
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
         const locationId = resolveLocationId(character.locationId);

         // The action must be offered where the character stands NOW, not where
         // the (possibly stale) panel was rendered.
         if (!local || !actionsAt(locationId).some((offered) => offered.id === local.id)) {
            await interaction.reply({ content: 'Nothing of the sort can be done where you now stand. Open a fresh `/play`.', ...ephemeral });
            return;
         }

         const state = await locationStateService.getFresh(locationId);
         const availability = evaluateCondition(local.availability, worldContext(state, character));
         if (!availability.ok) {
            await interaction.reply({ content: `🔒 **${local.label}** — ${availability.reason}.`, ...ephemeral });
            return;
         }

         // LIVE actions (no comingSoon line) route to their executors — a
         // mutation, so the D28 choreography: fast-fail if locked, ack before
         // the lock (the wait can pass the ~3 s window), execute, repaint.
         // Hub actions are buttons; the guard narrows the interaction type.
         if (local.id === 'forage' && interaction.isButton()) {
            if (client.locks.isLocked(character._id)) {
               await interaction.reply({ content: 'Your character is mid-activity — finish it first.', ...ephemeral });
               return;
            }

            await interaction.deferUpdate();
            await performForage(client, interaction, character);
            return;
         }

         // Read-only: repaints the hub into the NPC picker (no lock — the real
         // validation reruns when a picked NPC is clicked).
         if (local.id === 'talk' && interaction.isButton()) {
            await showTalkPicker(interaction, character, locationId);
            return;
         }

         await interaction.reply({
            content: `${local.emoji} ${local.comingSoon ?? 'Nothing comes of it — yet.'} _(coming soon)_`,
            ...ephemeral,
         });
         return;
      }

      // The picker's pick: opens the dialogue session (S4/D45). The mutation
      // choreography (D28): fast-fail if locked, ack, execute under the lock.
      if (action === 'talkto' && interaction.isButton()) {
         if (client.locks.isLocked(character._id)) {
            await interaction.reply({ content: 'Your character is mid-activity — finish it first.', ...ephemeral });
            return;
         }

         await interaction.deferUpdate();
         await performTalk(client, interaction, character, args[0] ?? '');
         return;
      }

      // The picker's "Never mind": back to the hub (read-only repaint).
      if (action === 'hub' && interaction.isButton()) {
         await interaction.update(await freshHubView(character));
         return;
      }

      // A component from an older hub whose action is gone — ignore quietly.
      await interaction.reply({ content: 'That option is no longer available. Open a fresh `/play`.', ...ephemeral });
   },
} satisfies ComponentHandler;
