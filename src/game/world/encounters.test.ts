import { afterEach, describe, expect, it, vi } from 'vitest';
import { eligibleEncounters, rollTravelEncounter, travelEncounterChance } from './encounters.js';
import { ENCOUNTERS, TRAVEL_ENCOUNTER_CHANCE_PERCENT, type ChallengeOption, type EncounterDefinition } from '../data/encounters.js';
import { LOCATIONS, type LocationDefinition, type LocationId } from '../data/locations.js';
import type { WorldContext } from './conditions.js';

afterEach(() => {
   vi.restoreAllMocks();
});

const ctx = (overrides: Partial<WorldContext> = {}): WorldContext => ({
   timeOfDay: 'day',
   weather: 'clear',
   activeEventIds: [],
   discoveredFeatureIds: [],
   ...overrides,
});

describe('eligibleEncounters', () => {
   it("includes 'anywhere' encounters for every destination", () => {
      const ids = eligibleEncounters('spire').map((e) => e.id);
      expect(ids).toContain('patrol_gossip');
   });

   it('scopes location-bound encounters to their destinations', () => {
      expect(eligibleEncounters('tavern').map((e) => e.id)).toContain('fallen_tree');
      expect(eligibleEncounters('spire').map((e) => e.id)).not.toContain('fallen_tree');
   });
});

// Content-integrity checks (like the location-graph test): a malformed
// challenge in the catalog should fail `npm test`, not surface mid-game.
describe('ENCOUNTERS catalog', () => {
   const activities = Object.entries(ENCOUNTERS).filter(([, def]) => def.kind === 'activity');

   it('gives every challenge unique option ids', () => {
      for (const [id, def] of activities) {
         if (def.kind !== 'activity')
            continue;
         const ids = def.options.map((option) => option.id);
         expect(new Set(ids).size, `${id} has duplicate option ids`).toBe(ids.length);
      }
   });

   it('gives every checked option a failure outcome and every challenge a setback cap', () => {
      for (const [id, def] of activities) {
         if (def.kind !== 'activity')
            continue;
         expect(def.maxSetbacks, `${id} needs maxSetbacks >= 1`).toBeGreaterThanOrEqual(1);
         for (const option of def.options as readonly ChallengeOption[]) {
            if (option.check)
               expect(option.failure, `${id}/${option.id} has a check but no failure outcome`).toBeDefined();
         }
      }
   });

   // The challenge panel renders one button per option + Turn back, chunked
   // 5-wide into Discord's 5-row cap — >24 options would make the step
   // unsendable. Catch the content edit here, not mid-crossing.
   it('keeps every challenge renderable (≤ 24 options)', () => {
      for (const [id, def] of activities) {
         if (def.kind !== 'activity')
            continue;
         expect(def.options.length, `${id} overflows the challenge button rows`).toBeLessThanOrEqual(24);
      }
   });
});

describe('conditional encounters (D31)', () => {
   it('filters by context when one is provided, stays unfiltered without one', () => {
      expect(eligibleEncounters('riverbank', ctx({ timeOfDay: 'night' })).map((e) => e.id)).toContain('reed_glimmer');
      expect(eligibleEncounters('riverbank', ctx({ timeOfDay: 'day' })).map((e) => e.id)).not.toContain('reed_glimmer');
      expect(eligibleEncounters('riverbank').map((e) => e.id)).toContain('reed_glimmer');
   });

   it('gates weather-bound encounters on the current weather', () => {
      expect(eligibleEncounters('plaza', ctx({ weather: 'storm' })).map((e) => e.id)).toContain('soaked_traveler');
      expect(eligibleEncounters('plaza', ctx({ weather: 'clear' })).map((e) => e.id)).not.toContain('soaked_traveler');
   });

   it('gates trait-bound encounters on the arriving character', () => {
      expect(eligibleEncounters('plaza', ctx({ traits: { empathy: 1 } })).map((e) => e.id)).toContain('grateful_beggar');
      expect(eligibleEncounters('plaza', ctx()).map((e) => e.id)).not.toContain('grateful_beggar');
   });

   it('discovers only features that exist at every destination it can fire on', () => {
      for (const [id, def] of Object.entries(ENCOUNTERS) as [string, EncounterDefinition][]) {
         const discovers: string[] = [];
         if (def.kind === 'flavor' && def.discovers)
            discovers.push(def.discovers);
         if (def.kind === 'activity') {
            for (const option of def.options as readonly ChallengeOption[]) {
               if (option.success.discovers)
                  discovers.push(option.success.discovers);
               if (option.failure?.discovers)
                  discovers.push(option.failure.discovers);
            }
         }
         if (discovers.length === 0)
            continue;

         expect(Array.isArray(def.locations), `${id}: discovering encounters need explicit locations`).toBe(true);
         for (const featureId of discovers)
            for (const locationId of def.locations as readonly string[]) {
               const location: LocationDefinition = LOCATIONS[locationId as LocationId];
               expect(
                  location.features?.some((feature) => feature.id === featureId),
                  `${id}: '${featureId}' is not a feature of ${locationId}`,
               ).toBe(true);
            }
      }
   });
});

describe('travelEncounterChance', () => {
   it('adds destination danger on top of the base chance, capped at 95', () => {
      expect(travelEncounterChance(0)).toBe(TRAVEL_ENCOUNTER_CHANCE_PERCENT);
      expect(travelEncounterChance(40)).toBe(TRAVEL_ENCOUNTER_CHANCE_PERCENT + 10);
      expect(travelEncounterChance(1000)).toBeLessThanOrEqual(95);
   });
});

describe('rollTravelEncounter', () => {
   it('returns null when the encounter chance misses', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // 99 ≥ chance percent
      expect(rollTravelEncounter('tavern')).toBeNull();
   });

   it('returns a weighted pick from the eligible pool when the chance hits', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance hits; weighted pick → first entry
      const rolled = rollTravelEncounter('tavern');

      expect(rolled).not.toBeNull();
      expect(rolled!.encounter).toBe(ENCOUNTERS[rolled!.id]);
      expect(eligibleEncounters('tavern').map((e) => e.id)).toContain(rolled!.id);
   });
});
