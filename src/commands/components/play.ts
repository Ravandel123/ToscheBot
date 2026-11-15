import type { ButtonInteraction } from 'discord.js';
import type { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { locationStateService } from '../../db/services/locationStateService.js';
import { smackdownService } from '../../db/services/smackdownService.js';
import { displayName } from '../../game/character/identity.js';
import { LADDER_LENGTH } from '../../game/combat/spireLadder.js';
import { actionsAt, hubAction } from '../../game/data/hubActions.js';
import { resolveLocationId, type LocationId } from '../../game/data/locations.js';
import { evaluateCondition, worldContext } from '../../game/world/conditions.js';
import { activityStepView } from './_activities/registry.js';
import { deferIfFree, NO_ACTIVE_CHARACTER } from './_characterAction.js';
import { performForage } from './_forageAction.js';
import { openMarket } from './_marketAction.js';
import { performTalk, showTalkPicker } from './_talkAction.js';
import { freshHubView } from './_hubView.js';
import { buildInventoryHub } from './_inventoryPanel.js';
import { buildFightingStylePanel } from './_combatPlanView.js';
import { buildSkillOverview } from './_skillPanel.js';
import { performTravel } from './_playPanel.js';
import { buildTrialBrowser } from './_trialView.js';
import { ephemeral, type PanelView } from '../../lib/discord.js';
import type { ToscheClient } from '../../client.js';
import type { CharacterDoc } from '../../db/models/character.js';

// Handles the `/play` game hub (namespace `play`). The hub is ephemeral and
// personal, so the clicker is always the active-character owner (like the
// account panel). Actions:
//   * `play:travel` — a destination select; a mutation (spend AP, move, maybe
//     start a challenge), run under the character lock by performTravel;
//   * `play:act:<id>` — a location action, run by its HUB_EXECUTORS entry.
//     Location and availability are re-checked at CLICK time — a hub message
//     can outlive a move, a nightfall or an event's end;
//   * `play:talkto:<npc>` — the talk picker's pick, opens a conversation;
//   * `play:open:<panel>` — a shortcut: repaints the hub into one of the
//     character's own panels (pack, skills, fighting style), exactly what the
//     matching slash command would show;
//   * `play:hub` — back to the hub ("Back to /play", "Never mind", "Leave the
//     stall"), or to the unfinished activity, as `/play` itself would.

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
   async forage({ client, interaction, character }) {
      if (await deferIfFree(client, interaction, character._id))
         await performForage(client, interaction, character);
   },

   // Repaints the hub into the merchant's stall. Opening is a read, except
   // that the day's first visitor triggers the merchant's daily routine under
   // the MERCHANT's lock — so ack first; the trades themselves live in the
   // `market` component.
   async market({ client, interaction, character }) {
      await interaction.deferUpdate();
      await openMarket(client, interaction, character._id);
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
const HUB_PANELS: Partial<Record<string, (character: CharacterDoc) => PanelView>> = {
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
         await interaction.reply({ content: NO_ACTIVE_CHARACTER, ...ephemeral });
         return;
      }

      if (action === 'travel' && interaction.isStringSelectMenu()) {
         if (await deferIfFree(client, interaction, character._id))
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

      if (action === 'talkto' && interaction.isButton()) {
         if (await deferIfFree(client, interaction, character._id))
            await performTalk(client, interaction, character, args[0] ?? '');
         return;
      }

      // Read-only repaint, landing where `/play` would: the unfinished
      // activity if there is one, otherwise the hub.
      if (action === 'hub' && interaction.isButton()) {
         const session = await activitySessionService.getActiveForParticipant(character._id);
         await interaction.update(session ? activityStepView(session) : await freshHubView(character));
         return;
      }

      // A component from an older hub whose action is gone — ignore quietly.
      await interaction.reply({ content: 'That option is no longer available. Open a fresh `/play`.', ...ephemeral });
   },
} satisfies ComponentHandler;
