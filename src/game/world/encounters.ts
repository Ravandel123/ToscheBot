import { chance, weightedItem } from '../../lib/random.js';
import { ENCOUNTERS, TRAVEL_ENCOUNTER_CHANCE_PERCENT, type EncounterDefinition, type EncounterId } from '../data/encounters.js';
import { evaluateCondition, type WorldContext } from './conditions.js';

// Pure encounter rolling (D21/D31). Randomness comes from lib/random, so tests
// pin it with vi.spyOn(Math, 'random') like everywhere else.

export interface RolledEncounter {
   id: EncounterId;
   encounter: EncounterDefinition;
}

/** Each extra point of location danger adds this much encounter chance. 🟡 tunable. */
const DANGER_ENCOUNTER_CHANCE_PER_POINT = 0.25;

/** The encounter chance for a move, biased by the destination's danger stat
 *  (a perilous riverbank throws more at travelers than the palace yard). */
export function travelEncounterChance(danger: number): number {
   return Math.min(95, TRAVEL_ENCOUNTER_CHANCE_PERCENT + Math.round(danger * DANGER_ENCOUNTER_CHANCE_PER_POINT));
}

/** Every encounter that may fire when arriving at `destinationId`. With a
 *  context, conditional encounters (D31) are filtered by their criteria;
 *  without one, only the location scoping applies. */
export function eligibleEncounters(destinationId: string, ctx?: WorldContext): RolledEncounter[] {
   return (Object.entries(ENCOUNTERS) as [EncounterId, EncounterDefinition][])
      .filter(([, def]) => def.locations === 'anywhere' || def.locations.includes(destinationId))
      .filter(([, def]) => !ctx || evaluateCondition(def.conditions, ctx).ok)
      .map(([id, encounter]) => ({ id, encounter }));
}

/** Rolls the travel encounter for a move: usually none, otherwise a weighted pick. */
export function rollTravelEncounter(
   destinationId: string,
   ctx?: WorldContext,
   chancePercent = TRAVEL_ENCOUNTER_CHANCE_PERCENT,
): RolledEncounter | null {
   if (!chance(chancePercent))
      return null;

   const pool = eligibleEncounters(destinationId, ctx);
   if (pool.length === 0)
      return null;

   return weightedItem(pool.map((entry) => [entry, entry.encounter.weight] as const));
}
