import { TIMES_OF_DAY, timeOfDay, type TimeOfDayId } from './time.js';
import { WEATHER, resolveWeatherId, type WeatherId } from '../data/weather.js';
import { locationEvent } from '../data/locationEvents.js';
import { actionsAt, type HubAction } from '../data/hubActions.js';
import type { TraitKey } from '../data/traits.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { LocationStateDoc } from '../../db/models/locationState.js';

// The one condition language of the world (D31): hub actions, encounters and
// location events all gate on the same typed `LocationCondition`, evaluated by
// the same function — so "the market closes at night", "this encounter only
// fires in fog" and "bards' night only starts in the evening" are all one
// catalog field, not three mechanisms. Conditions are DATA (serializable,
// test-validated), not predicates: they can carry player-facing reasons and be
// rendered ("🔒 only during Bards' Night") without running anything.

export interface LocationCondition {
   /** Only during these parts of the game day. */
   timeOfDay?: readonly TimeOfDayId[];
   /** Only under one of these weather kinds. */
   weather?: readonly WeatherId[];
   /** Only while this location event is running (→ LocationEventId). */
   duringEvent?: string;
   /** Only after this feature of the location has been discovered. */
   requiresDiscovery?: string;
   /** Only for characters whose deed traits reach these values (D26's first gate). */
   minTraits?: Partial<Record<TraitKey, number>>;
}

/** Everything a condition can be judged against, snapshot at one instant. */
export interface WorldContext {
   timeOfDay: TimeOfDayId;
   weather: WeatherId;
   activeEventIds: readonly string[];
   discoveredFeatureIds: readonly string[];
   /** The acting character's deed traits; omit for character-less contexts. */
   traits?: Partial<Record<TraitKey, number>>;
}

export type ConditionCheck = { ok: true } | { ok: false; reason: string };

/** Builds the evaluation context for a location's current state (+ optional actor). */
export function worldContext(state: LocationStateDoc, character?: Pick<CharacterDoc, 'traits'>, now = new Date()): WorldContext {
   return {
      timeOfDay: timeOfDay(now),
      weather: resolveWeatherId(state.weather.kind),
      activeEventIds: (state.events ?? []).map((event) => event.eventId),
      discoveredFeatureIds: state.discoveredFeatureIds ?? [],
      traits: character?.traits,
   };
}

/**
 * Whether `condition` holds in `ctx`. The first miss wins and carries a short,
 * player-facing reason ("only during the evening or night"). No condition =
 * always ok.
 */
export function evaluateCondition(condition: LocationCondition | undefined, ctx: WorldContext): ConditionCheck {
   if (!condition)
      return { ok: true };

   if (condition.timeOfDay && !condition.timeOfDay.includes(ctx.timeOfDay)) {
      const when = condition.timeOfDay.map((id) => TIMES_OF_DAY[id].name.toLowerCase()).join(' or ');
      return { ok: false, reason: `only during the ${when}` };
   }

   if (condition.weather && !condition.weather.includes(ctx.weather)) {
      const kinds = condition.weather.map((id) => WEATHER[id].name.toLowerCase()).join(' or ');
      return { ok: false, reason: `only under ${kinds}` };
   }

   if (condition.duringEvent && !ctx.activeEventIds.includes(condition.duringEvent))
      return { ok: false, reason: `only during ${locationEvent(condition.duringEvent)?.name ?? 'a special occasion'}` };

   if (condition.requiresDiscovery && !ctx.discoveredFeatureIds.includes(condition.requiresDiscovery))
      return { ok: false, reason: 'no one has found it yet' };

   if (condition.minTraits)
      for (const [key, min] of Object.entries(condition.minTraits))
         if ((ctx.traits?.[key as TraitKey] ?? 0) < (min ?? 0))
            return { ok: false, reason: 'not for the likes of you' };

   return { ok: true };
}

export interface AvailableHubAction {
   action: HubAction;
   ok: boolean;
   /** Why it is closed (set when `!ok` and the action is shown anyway). */
   reason?: string;
}

/** The hub's action list under current conditions: hidden ones (undiscovered
 *  secrets) are dropped entirely; the rest carry open/closed + the reason,
 *  so the panel can render "🔒 Browse the market — only during the morning". */
export function availableHubActions(locationId: string, ctx: WorldContext): AvailableHubAction[] {
   return actionsAt(locationId).flatMap((action): AvailableHubAction[] => {
      const check = evaluateCondition(action.availability, ctx);

      if (check.ok)
         return [{ action, ok: true }];
      if (action.availability?.hidden)
         return [];
      return [{ action, ok: false, reason: check.reason }];
   });
}
