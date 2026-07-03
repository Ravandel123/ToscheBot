import { chance, weightedItem } from '../../lib/random.js';
import { ENCOUNTERS, TRAVEL_ENCOUNTER_CHANCE_PERCENT, type EncounterDefinition, type EncounterId } from '../data/encounters.js';

// Pure encounter rolling (D21). Randomness comes from lib/random, so tests
// pin it with vi.spyOn(Math, 'random') like everywhere else.

export interface RolledEncounter {
   id: EncounterId;
   encounter: EncounterDefinition;
}

/** Every encounter that may fire when arriving at `destinationId`. */
export function eligibleEncounters(destinationId: string): RolledEncounter[] {
   return (Object.entries(ENCOUNTERS) as [EncounterId, EncounterDefinition][])
      .filter(([, def]) => def.locations === 'anywhere' || def.locations.includes(destinationId))
      .map(([id, encounter]) => ({ id, encounter }));
}

/** Rolls the travel encounter for a move: usually none, otherwise a weighted pick. */
export function rollTravelEncounter(destinationId: string): RolledEncounter | null {
   if (!chance(TRAVEL_ENCOUNTER_CHANCE_PERCENT))
      return null;

   const pool = eligibleEncounters(destinationId);
   if (pool.length === 0)
      return null;

   return weightedItem(pool.map((entry) => [entry, entry.encounter.weight] as const));
}
