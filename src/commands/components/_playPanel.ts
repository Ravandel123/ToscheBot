// Discord adapter (marked): the `/play` game hub — the location-centric board
// `/play` shows and the `play:*` components repaint. Stateless like the account
// panel and the comic browser: the hub is ephemeral and personal, so the
// clicking user IS the active-character owner, and all real state is re-read
// from the DB on every interaction (nothing rides in the customIds but the
// travel destination / action slug). This file also owns the travel EXECUTION
// that used to live in the standalone `/travel` command (folded into the hub):
// validate → spend AP → roll encounter → move or start a durable challenge
// (D17/D21/D26). A plain arrival re-renders the hub at the new place so the
// play loop continues; an 'activity' encounter hands the message to the
// challenge activity, exactly as `/travel` did.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
   type MessageComponentInteraction,
} from 'discord.js';
import { characterService } from '../../db/services/characterService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { canCharacterAct, type ActBlockReason } from '../../game/character/rules.js';
import { attributesWithEquipment } from '../../game/character/inventory.js';
import { displayName, STATUS_LABEL } from '../../game/character/identity.js';
import { LOCATIONS, locationName, resolveLocationId, type LocationId } from '../../game/data/locations.js';
import { actionsAt } from '../../game/data/hubActions.js';
import { TRAVEL_AP_COST, checkTravel, connectionsFrom, type TravelBlockReason } from '../../game/world/travel.js';
import { rollTravelEncounter } from '../../game/world/encounters.js';
import { initialChallengeState } from '../../game/activity/challenge.js';
import { checkTarget } from '../../game/checks.js';
import { postChronicle } from '../../game/chronicle.js';
import { randomItem } from '../../lib/random.js';
import { activityHandler } from './_activities/registry.js';
import type { ActivityEncounter, EncounterId } from '../../game/data/encounters.js';
import type { ActivitySessionDoc } from '../../db/models/activitySession.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

const HUB_COLOR = 0x3F5E7A; // campaign-map blue

export interface HubView {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

const ACT_BLOCK_MESSAGE: Record<ActBlockReason, string> = {
   'not-approved': 'Only characters recognized by the Imperator may roam Deltrada. Finish yours with `/character edit` and submit it.',
   'incapacitated': 'You are in no state to travel — recover first.',
   'no-action-points': 'You lack the Action Points for the road.',
};

/** The hub board for a character at its current location: where it can go
 *  (a travel select) and what it can do here (action buttons). Pure — no DB.
 *  `banner` shows a one-off line at the top (e.g. an arrival). */
export function buildHubView(character: CharacterDoc, banner?: string): HubView {
   const locationId = resolveLocationId(character.locationId);
   const location = LOCATIONS[locationId];
   const approved = character.approvalStatus === 'approved';
   const actions = actionsAt(locationId);

   const embed = new EmbedBuilder()
      .setColor(HUB_COLOR)
      .setTitle(`🗺️ ${displayName(character)} — ${location.name}`)
      .setDescription([
         banner ? `${banner}\n` : '',
         `_${location.description}_`,
         approved ? '' : `\n⚠️ ${STATUS_LABEL[character.approvalStatus]} — you cannot act until the Imperator recognizes you.`,
      ].filter(Boolean).join('\n'))
      .addFields(
         {
            name: '❤️ Health',
            value: `${character.resources.health.current}/${character.resources.health.max}`,
            inline: true,
         },
         { name: '⚡ Action Points', value: `${character.actionPoints.current}`, inline: true },
         {
            name: 'Here you can',
            value: actions.map((action) => `${action.emoji} **${action.label}** — ${action.description}`).join('\n') || '—',
         },
      )
      .setFooter({ text: 'Travel with the menu · other actions are coming soon' });

   return { embeds: [embed], components: hubComponents(character, locationId, actions) };
}

function hubComponents(
   character: CharacterDoc,
   locationId: LocationId,
   actions: ReturnType<typeof actionsAt>,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
   const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

   const destinations = connectionsFrom(locationId);
   if (destinations.length > 0) {
      const select = new StringSelectMenuBuilder()
         .setCustomId('play:travel')
         .setPlaceholder('🧭 Travel to…')
         .addOptions(
            destinations.map((id) => ({
               label: LOCATIONS[id].name,
               value: id,
               description: LOCATIONS[id].description.slice(0, 100),
               emoji: '🧭',
            })),
         );
      rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select));
   }

   // One button per local action, chunked into ≤5-wide rows (Discord limit).
   const buttons = actions.map((action) =>
      new ButtonBuilder()
         .setCustomId(`play:act:${action.id}`)
         .setLabel(action.label)
         .setEmoji(action.emoji)
         .setStyle(ButtonStyle.Secondary),
   );
   for (let i = 0; i < buttons.length; i += 5)
      rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons.slice(i, i + 5)));

   return rows;
}

/** Renders an active session's current step (re-entry / encounter start), or null
 *  if its type has no handler (a retired activity — caller degrades gracefully). */
export function sessionStepView(session: ActivitySessionDoc, note: string): (HubView & { content: string }) | null {
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
 * click can't move twice or open two sessions; the second run re-checks inside
 * the lock and re-enters. Repaints the hub's own (ephemeral) message.
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
         await interaction.editReply(hubWithNote(fresh, ACT_BLOCK_MESSAGE[act.reason]));
         return;
      }

      const travel = checkTravel(fresh.locationId, destination);
      if (!travel.ok) {
         await interaction.editReply(hubWithNote(fresh, travelBlockMessage(travel.reason, travel.from)));
         return;
      }

      if (!await characterService.spendActionPoints(fresh._id, TRAVEL_AP_COST)) {
         await interaction.editReply(hubWithNote(fresh, ACT_BLOCK_MESSAGE['no-action-points']));
         return;
      }

      const rolled = rollTravelEncounter(travel.to);

      // An 'activity' encounter interrupts the move — the character only arrives
      // if the activity ends in success (its handler moves them).
      if (rolled?.encounter.kind === 'activity') {
         const started = await startEncounterActivity(interaction, fresh, rolled.id, rolled.encounter, travel.from, travel.to);
         if (started)
            return;
      }

      await characterService.setLocation(fresh._id, travel.to);

      const flavorLine = rolled?.encounter.kind === 'flavor' ? randomItem(rolled.encounter.lines) : null;
      const arrived = await characterService.get(fresh._id);
      const banner = [`🧭 You leave **${locationName(travel.from)}** and arrive at **${locationName(travel.to)}**.`, flavorLine].filter(Boolean).join('\n');

      // Re-render the hub at the destination so the loop keeps going.
      await interaction.editReply(arrived ? { content: '', ...buildHubView(arrived, banner) } : { content: banner, embeds: [], components: [] });

      await postChronicle(client, [
         `🧭 **${displayName(fresh)}** traveled from **${locationName(travel.from)}** to **${locationName(travel.to)}**.`,
         flavorLine ? ` ${flavorLine}` : '',
      ].join(''));
   });
}

/** A hub repaint carrying a one-off note (a refusal reason or arrival flavor). */
function hubWithNote(character: CharacterDoc, note: string): HubView & { content: string } {
   return { content: '', ...buildHubView(character, note) };
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
