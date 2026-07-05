// Discord adapter (marked): the `/play` game hub's EXECUTION side — the travel
// move that used to live in the standalone `/travel` command (folded into the
// hub, D30): validate → spend AP → read the destination's live state → roll a
// (possibly conditional) encounter → move or start a durable challenge
// (D17/D21/D26/D31). The hub VIEW lives in `_hubView.ts`; this file owns the
// mutation choreography. A plain arrival re-renders the hub at the new place
// (with weather/events/presence freshly read) so the play loop continues; an
// 'activity' encounter hands the message to the challenge activity.
import type { MessageComponentInteraction } from 'discord.js';
import { characterService } from '../../db/services/characterService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { locationStateService } from '../../db/services/locationStateService.js';
import { canCharacterAct, type ActBlockReason } from '../../game/character/rules.js';
import { attributesWithEquipment } from '../../game/character/inventory.js';
import { displayName } from '../../game/character/identity.js';
import { LOCATIONS, locationName, type LocationId } from '../../game/data/locations.js';
import { statValue } from '../../game/data/locationStats.js';
import { TRAVEL_AP_COST, checkTravel, connectionsFrom, type TravelBlockReason } from '../../game/world/travel.js';
import { rollTravelEncounter, travelEncounterChance } from '../../game/world/encounters.js';
import { worldContext } from '../../game/world/conditions.js';
import { rollEventStart } from '../../game/world/events.js';
import { initialChallengeState } from '../../game/activity/challenge.js';
import { checkTarget } from '../../game/checks.js';
import { postChronicle } from '../../game/chronicle.js';
import { randomItem } from '../../lib/random.js';
import { activityHandler } from './_activities/registry.js';
import { freshHubView, revealFeature } from './_hubView.js';
import type { ActivityEncounter, EncounterId } from '../../game/data/encounters.js';
import type { ActivitySessionDoc } from '../../db/models/activitySession.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ActivityView } from '../../types/activities.js';
import type { ToscheClient } from '../../client.js';

const ACT_BLOCK_MESSAGE: Record<ActBlockReason, string> = {
   'not-approved': 'Only characters recognized by the Imperator may roam Deltrada. Finish yours with `/character create` and submit it.',
   'incapacitated': 'You are in no state to travel — recover first.',
   'no-action-points': 'You lack the Action Points for the road.',
};

/** Renders an active session's current step (re-entry / encounter start), or null
 *  if its type has no handler (a retired activity — caller degrades gracefully). */
export function sessionStepView(session: ActivitySessionDoc, note: string): (Required<Omit<ActivityView, 'content'>> & { content: string }) | null {
   const handler = activityHandler(session.type);
   if (!handler)
      return null;

   const view = handler.render(session);
   return { content: note, embeds: view.embeds ?? [], components: view.components ?? [] };
}

/**
 * Executes a travel move for the hub. The `interaction` must already be
 * acknowledged with `deferUpdate()` (the lock wait + writes can pass the ~3 s
 * ack window). Serializes the whole decision per character so a double-fired
 * click can't move twice or open two sessions — and a STALE panel (one of
 * several open hubs) is caught by re-reading the character inside the lock:
 * the edge is validated from where the character stands NOW, not where the
 * panel was rendered. Repaints the hub's own (ephemeral) message.
 */
export async function performTravel(
   client: ToscheClient,
   interaction: MessageComponentInteraction,
   character: CharacterDoc,
   destination: string,
): Promise<void> {
   await client.locks.runExclusive([character._id], async () => {
      const fresh = await characterService.get(character._id);
      if (!fresh) {
         await interaction.editReply({ content: 'Your character vanished mid-stride. Try again.', embeds: [], components: [] });
         return;
      }

      // Cross-restart busy check (D17): an active session means re-entry, not a move.
      const session = await activitySessionService.getActiveForParticipant(fresh._id);
      if (session) {
         await editReplyStep(interaction, session, '⚠️ You are already in the middle of something — deal with it first.');
         return;
      }

      const act = canCharacterAct(fresh, TRAVEL_AP_COST);
      if (!act.ok) {
         await interaction.editReply(await freshHubView(fresh, ACT_BLOCK_MESSAGE[act.reason]));
         return;
      }

      const travel = checkTravel(fresh.locationId, destination);
      if (!travel.ok) {
         await interaction.editReply(await freshHubView(fresh, travelBlockMessage(travel.reason, travel.from)));
         return;
      }

      if (!await characterService.spendActionPoints(fresh._id, TRAVEL_AP_COST)) {
         await interaction.editReply(await freshHubView(fresh, ACT_BLOCK_MESSAGE['no-action-points']));
         return;
      }

      // The DESTINATION's live state shapes the road (D31): conditional
      // encounters read it, and its danger raises the encounter odds.
      const destinationState = await locationStateService.getFresh(travel.to);
      const ctx = worldContext(destinationState, fresh);
      const rolled = rollTravelEncounter(travel.to, ctx, travelEncounterChance(statValue(travel.to, destinationState.stats, 'danger')));

      // An 'activity' encounter interrupts the move — the character only arrives
      // if the activity ends in success (its handler moves them).
      if (rolled?.encounter.kind === 'activity') {
         const started = await startEncounterActivity(interaction, fresh, rolled.id, rolled.encounter, travel.from, travel.to);
         if (started)
            return;
      }

      await characterService.setLocation(fresh._id, travel.to);
      await locationStateService.recordVisit(travel.to);

      const flavorLine = rolled?.encounter.kind === 'flavor' ? randomItem(rolled.encounter.lines) : null;
      const discoveryLine = rolled?.encounter.kind === 'flavor' && rolled.encounter.discovers
         ? await revealFeature(client, fresh, travel.to, rolled.encounter.discovers)
         : null;

      // An arrival can spark a location event (D31) — the write is guarded, so
      // of two simultaneous arrivals only one starts (and announces) it.
      const eventRoll = rollEventStart(travel.to, ctx);
      const startedEvent = eventRoll && await locationStateService.tryStartEvent(travel.to, eventRoll.id, eventRoll.startedAt, eventRoll.endsAt)
         ? eventRoll
         : null;

      const arrived = await characterService.get(fresh._id);
      const banner = [
         `🧭 You leave **${locationName(travel.from)}** and arrive at **${locationName(travel.to)}**.`,
         flavorLine,
         discoveryLine,
         startedEvent ? `${startedEvent.event.emoji} **${startedEvent.event.name}** has just begun here!` : null,
      ].filter(Boolean).join('\n');

      // Re-render the hub at the destination so the loop keeps going.
      await interaction.editReply(arrived ? await freshHubView(arrived, banner) : { content: banner, embeds: [], components: [] });

      await postChronicle(client, [
         `🧭 **${displayName(fresh)}** traveled from **${locationName(travel.from)}** to **${locationName(travel.to)}**.`,
         flavorLine ? ` ${flavorLine}` : '',
      ].join(''));

      if (startedEvent)
         await postChronicle(client, `${startedEvent.event.emoji} **${startedEvent.event.name}** breaks out at **${locationName(travel.to)}**!`);
   });
}

async function editReplyStep(interaction: MessageComponentInteraction, session: ActivitySessionDoc, note: string): Promise<void> {
   const view = sessionStepView(session, note);
   await interaction.editReply(view ?? { content: `${note}\n(Your character is busy with: ${session.type}.)`, embeds: [], components: [] });
}

/** Spawns the ActivitySession for an 'activity' encounter and shows its first
 *  step. Unknown activity types degrade to no encounter (the move completes). */
async function startEncounterActivity(
   interaction: MessageComponentInteraction,
   character: CharacterDoc,
   encounterId: EncounterId,
   encounter: ActivityEncounter,
   from: LocationId,
   to: LocationId,
): Promise<boolean> {
   // Travel's AP charge is the session's start cost (D17) — no extra charge here.
   if (encounter.activityType !== 'challenge')
      return false;

   // Per-option d100 targets are computed HERE, from the live (equipment-modified)
   // character, and stored in the session so the stateless panel shows honest %
   // odds on every repaint without re-deriving stats (D26/D28).
   const subject = { ...character, attributes: attributesWithEquipment(character) };
   const optionTargets = Object.fromEntries(
      encounter.options.flatMap((option) => (option.check ? [[option.id, checkTarget(subject, option.check)] as const] : [])),
   );

   const created = await activitySessionService.create('challenge', [character._id], { ...initialChallengeState(encounterId, from, to, optionTargets) });
   await editReplyStep(interaction, created, `⚠️ **${encounter.name}!**`);
   return true;
}

function travelBlockMessage(reason: TravelBlockReason, from: LocationId): string {
   const roads = connectionsFrom(from).map((id) => `**${LOCATIONS[id].name}**`).join(', ') || 'nowhere';

   if (reason === 'same-location')
      return `You are already at **${locationName(from)}**. Roads lead to: ${roads}.`;
   if (reason === 'not-connected')
      return `No road leads there from **${locationName(from)}**. You can reach: ${roads}.`;
   return `No such place is known. From **${locationName(from)}** you can reach: ${roads}.`;
}
