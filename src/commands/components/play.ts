import { MessageFlags, type ButtonInteraction } from 'discord.js';
import type { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { locationStateService } from '../../db/services/locationStateService.js';
import { smackdownService } from '../../db/services/smackdownService.js';
import { displayName } from '../../game/character/identity.js';
import { LADDER_LENGTH } from '../../game/combat/spireLadder.js';
import { actionsAt, hubAction } from '../../game/data/hubActions.js';
import { resolveLocationId, type LocationId } from '../../game/data/locations.js';
import { evaluateCondition, worldContext } from '../../game/world/conditions.js';
import { performForage } from './_forageAction.js';
import { openMarket } from './_marketAction.js';
import { performTalk, showTalkPicker } from './_talkAction.js';
import { freshHubView } from './_hubView.js';
import { buildInventoryHub } from './_inventoryPanel.js';
import { buildFightingStylePanel } from './_combatPlanView.js';
import { buildSkillOverview } from './_skillPanel.js';
import { performTravel } from './_playPanel.js';
import { buildTrialBrowser } from './_trialView.js';
import type { ToscheClient } from '../../client.js';
import type { CharacterDoc } from '../../db/models/character.js';

// Handles the `/play` game hub (namespace `play`). The hub is ephemeral and
// personal, so the clicker is always the active-character owner (like the
// account panel). Two actions today:
//   * `play:travel`  — a destination select; mutates state (spend AP, move,
//     maybe start a challenge), so it follows the D28 mutation choreography:
//     fast-fail if in-memory locked → deferUpdate → runExclusive (in
//     performTravel) → repaint;
//   * `play:act:<id>` — a location action, run by its HUB_EXECUTORS entry.
//     Location and availability (D31) are re-checked at CLICK time — a hub
//     message can outlive a move, a nightfall or an event's end (stale panels);
//   * `play:open:<panel>` — a shortcut: repaints the hub into one of the
//     character's own panels (pack, skills, fighting style), exactly what the
//     matching slash command would show (D59); the panel's "Back to /play"
//     (`play:hub`) repaints it back.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

interface HubActionCall {
   client: ToscheClient;
   interaction: ButtonInteraction;
   character: CharacterDoc;
   locationId: LocationId;
}

// What each LIVE hub action does. Making an action live = one entry here plus
// dropping its `comingSoon` line in the hub-action catalog. Each executor must
// respond to the interaction exactly once.
const HUB_EXECUTORS: Partial<Record<string, (call: HubActionCall) => Promise<void>>> = {
   // A mutation: fast-fail if locked, ack before the lock (the wait can pass
   // the ~3 s window), execute, repaint.
   async forage({ client, interaction, character }) {
      if (client.locks.isLocked(character._id)) {
         await interaction.reply({ content: 'Your character is mid-activity — finish it first.', ...ephemeral });
         return;
      }

      await interaction.deferUpdate();
      await performForage(client, interaction, character);
   },

   // Repaints the hub into the merchant's stall. Opening is a read, except
   // that the day's first visitor triggers the merchant's daily routine under
   // the MERCHANT's lock — so ack first; the trades themselves live in the
   // `market` component.
   async market({ client, interaction, character }) {
      await interaction.deferUpdate();
      await openMarket(client, interaction, character);
   },

   // Read-only: repaints the hub into the NPC picker (no lock — the real
   // validation reruns when a picked NPC is clicked).
   async talk({ interaction, character, locationId }) {
      await showTalkPicker(interaction, character, locationId);
   },

   // Read-only: opens the Spire-ladder browser as its own panel (the same one
   // `/smackdown trial` opens); the Fight button there does the validation.
   async arena({ interaction, character }) {
      const record = await smackdownService.getOrCreate(character._id, displayName(character));
      const clearedRung = record.trialRung ?? 0;
      await interaction.reply({ ...buildTrialBrowser(clearedRung, Math.min(clearedRung, LADDER_LENGTH - 1)), ...ephemeral });
   },
};

// The hub's shortcut buttons → the panel each opens (the same builders the
// slash commands use, so the two can never drift apart).
const HUB_PANELS: Partial<Record<string, (character: CharacterDoc) => object>> = {
   inventory: (character) => buildInventoryHub(character),
   skills: buildSkillOverview,
   style: buildFightingStylePanel,
};

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

      if (action === 'open') {
         const panel = HUB_PANELS[args[0] ?? ''];
         if (!panel || !interaction.isButton()) {
            await interaction.reply({ content: 'That panel is gone. Open a fresh `/play`.', ...ephemeral });
            return;
         }

         await interaction.update(panel(character));
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

         const execute = HUB_EXECUTORS[local.id];
         if (execute && interaction.isButton()) {
            await execute({ client, interaction, character, locationId });
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

      // Back to the hub (read-only repaint): the talk picker's "Never mind",
      // the stall's "Leave", and every panel's "Back to /play".
      if (action === 'hub' && interaction.isButton()) {
         await interaction.update(await freshHubView(character));
         return;
      }

      // A component from an older hub whose action is gone — ignore quietly.
      await interaction.reply({ content: 'That option is no longer available. Open a fresh `/play`.', ...ephemeral });
   },
} satisfies ComponentHandler;
