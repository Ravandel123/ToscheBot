import { chance, randomInt } from '../../lib/random.js';
import { LOCATION_EVENTS, type LocationEventDefinition, type LocationEventId } from '../data/locationEvents.js';
import { evaluateCondition, type WorldContext } from './conditions.js';

// Pure event rolling (D31) — no Discord, no DB. Arrivals ask "does something
// break out here right now?"; the caller commits the winner via the
// filter-guarded locationStateService.tryStartEvent (a concurrent arrival can
// roll the same event — only one write wins, only the winner announces it).

export interface EventStartRoll {
   id: LocationEventId;
   event: LocationEventDefinition;
   startedAt: Date;
   endsAt: Date;
}

/** Events that could break out at this location right now: offered here, not
 *  already running, and their start conditions hold. */
export function startableEvents(locationId: string, ctx: WorldContext): [LocationEventId, LocationEventDefinition][] {
   return (Object.entries(LOCATION_EVENTS) as [LocationEventId, LocationEventDefinition][]).filter(
      ([id, event]) =>
         !ctx.activeEventIds.includes(id)
         && (event.locations === 'anywhere' || event.locations.includes(locationId))
         && evaluateCondition(event.conditions, ctx).ok,
   );
}

/** Rolls whether this arrival sparks a location event; at most one starts. */
export function rollEventStart(locationId: string, ctx: WorldContext, now = new Date()): EventStartRoll | null {
   for (const [id, event] of startableEvents(locationId, ctx)) {
      if (!chance(event.startChancePercent))
         continue;

      const hours = randomInt(event.durationHours.min, event.durationHours.max);
      return { id, event, startedAt: now, endsAt: new Date(now.getTime() + hours * 3_600_000) };
   }

   return null;
}
