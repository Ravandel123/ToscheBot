// Discord adapter (marked): the `/play` hub VIEW — what a location looks like
// to a character standing in it (weather, time of day, running events, who is
// here, what can be done) — plus the loader for its dynamic context and the
// shared discovery announcer. Split from _playPanel.ts so the challenge
// activity can re-render the hub on arrival without importing the travel
// execution (which would cycle through the activity registry).
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type Client,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import { characterService } from '../../db/services/characterService.js';
import { locationStateService } from '../../db/services/locationStateService.js';
import { displayName, STATUS_LABEL } from '../../game/character/identity.js';
import { postChronicle } from '../../game/chronicle.js';
import { LOCATIONS, locationFeature, locationName, resolveLocationId, type LocationId } from '../../game/data/locations.js';
import { locationEvent } from '../../game/data/locationEvents.js';
import { LOCATION_STATS, statBand, statValue } from '../../game/data/locationStats.js';
import { WEATHER } from '../../game/data/weather.js';
import { TIMES_OF_DAY } from '../../game/world/time.js';
import { availableHubActions, worldContext, type AvailableHubAction, type WorldContext } from '../../game/world/conditions.js';
import { connectionsFrom } from '../../game/world/travel.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { LocationStateDoc } from '../../db/models/locationState.js';

const HUB_COLOR = 0x3F5E7A; // campaign-map blue
const PRESENCE_NAME_CAP = 10;

export interface HubView {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** One character present at a location (the projection `atLocation` returns). */
type PresentCharacter = Pick<CharacterDoc, '_id' | 'ownerId' | 'identity'>;

/** Everything dynamic one hub render needs, loaded in one place. */
export interface HubContext {
   state: LocationStateDoc;
   ctx: WorldContext;
   present: PresentCharacter[];
}

/** Reads the dynamic pieces of a hub render: location state (lazily freshened)
 *  and presence (derived from Character.locationId). Read-mostly — safe outside
 *  the character lock; staleness self-heals on the next repaint. */
export async function loadHubContext(locationId: string, character: CharacterDoc): Promise<HubContext> {
   const [state, present] = await Promise.all([
      locationStateService.getFresh(locationId),
      characterService.atLocation(locationId),
   ]);

   return { state, ctx: worldContext(state, character), present };
}

/** Loads the context and builds the hub for wherever the character stands NOW —
 *  the one-call repaint used by travel, refusals and activity endings. */
export async function freshHubView(character: CharacterDoc, banner?: string): Promise<HubView & { content: string }> {
   const hub = await loadHubContext(resolveLocationId(character.locationId), character);
   return { content: '', ...buildHubView(character, hub, banner) };
}

/** The hub board for a character at its current location: conditions, company,
 *  where it can go and what it can do here. Pure — no DB (context is loaded).
 *  `banner` shows a one-off line at the top (e.g. an arrival). */
export function buildHubView(character: CharacterDoc, hub: HubContext, banner?: string): HubView {
   const locationId = resolveLocationId(character.locationId);
   const location = LOCATIONS[locationId];
   const approved = character.approvalStatus === 'approved';
   const actions = availableHubActions(locationId, hub.ctx);

   const weather = WEATHER[hub.ctx.weather];
   const time = TIMES_OF_DAY[hub.ctx.timeOfDay];
   const danger = statBand('danger', statValue(locationId, hub.state.stats, 'danger'));
   const prosperity = statBand('prosperity', statValue(locationId, hub.state.stats, 'prosperity'));

   const eventLines = hub.ctx.activeEventIds.map((id) => {
      const event = locationEvent(id);
      return event ? `${event.emoji} **${event.name}** — ${event.banner}` : '';
   });

   const embed = new EmbedBuilder()
      .setColor(HUB_COLOR)
      .setTitle(`🗺️ ${displayName(character)} — ${location.name}`)
      .setDescription([
         banner ? `${banner}\n` : '',
         `_${location.description}_`,
         `${weather.emoji} _${weather.hubLine}_`,
         `${time.emoji} ${time.name} · ${LOCATION_STATS.danger.emoji} feels ${danger} · ${LOCATION_STATS.prosperity.emoji} looks ${prosperity}`,
         ...eventLines,
         approved ? '' : `\n⚠️ ${STATUS_LABEL[character.approvalStatus]} — you cannot act until the Imperator recognizes you.`,
      ].filter(Boolean).join('\n'))
      .addFields(
         {
            name: '❤️ Health',
            value: `${character.resources.health.current}/${character.resources.health.max}`,
            inline: true,
         },
         { name: '⚡ Action Points', value: `${character.actionPoints.current}`, inline: true },
         { name: `👥 Souls here (${hub.present.length})`, value: presenceLine(hub.present, character._id) },
         {
            name: 'Here you can',
            value: actions.map(actionLine).join('\n') || '—',
         },
      )
      .setFooter({ text: 'Travel with the menu · 🔒 = not available right now' });

   return { embeds: [embed], components: hubComponents(locationId, actions) };
}

/** Marks a feature discovered; when it is NEW, chronicles the find and returns
 *  the in-character reveal line for the discoverer's banner (null otherwise). */
export async function revealFeature(
   client: Client,
   actor: Pick<CharacterDoc, 'identity'>,
   locationId: string,
   featureId: string,
): Promise<string | null> {
   const newly = await locationStateService.discoverFeature(locationId, featureId);
   if (!newly)
      return null;

   const feature = locationFeature(locationId, featureId);
   const name = feature?.name ?? 'something long forgotten';
   await postChronicle(client, `🔎 **${displayName(actor)}** discovered **${name}** at **${locationName(locationId)}**!`);

   return `🔎 ${feature?.discoveryLine ?? `You discover ${name}.`}`;
}

function presenceLine(present: PresentCharacter[], viewerId: string): string {
   if (present.length === 0)
      return 'Not a soul in sight.';

   const names = present.map((who) => {
      if (who._id === viewerId)
         return `**${displayName(who)}** (you)`;
      return who.ownerId === null ? `${displayName(who)} *(NPC)*` : displayName(who);
   });

   const shown = names.slice(0, PRESENCE_NAME_CAP);
   const more = names.length - shown.length;
   return shown.join(', ') + (more > 0 ? ` … and ${more} more` : '');
}

function actionLine({ action, ok, reason }: AvailableHubAction): string {
   return ok
      ? `${action.emoji} **${action.label}** — ${action.description}`
      : `🔒 **${action.label}** — ${reason}.`;
}

function hubComponents(locationId: LocationId, actions: AvailableHubAction[]): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
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

   // One button per local action (closed ones stay visible but disabled),
   // chunked into ≤5-wide rows (Discord limit).
   const buttons = actions.map(({ action, ok }) =>
      new ButtonBuilder()
         .setCustomId(`play:act:${action.id}`)
         .setLabel(action.label)
         .setEmoji(action.emoji)
         .setStyle(ButtonStyle.Secondary)
         .setDisabled(!ok),
   );
   for (let i = 0; i < buttons.length; i += 5)
      rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons.slice(i, i + 5)));

   return rows;
}
