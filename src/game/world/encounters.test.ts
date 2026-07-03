import { afterEach, describe, expect, it, vi } from 'vitest';
import { eligibleEncounters, rollTravelEncounter } from './encounters.js';
import { ENCOUNTERS, type ChallengeOption } from '../data/encounters.js';

afterEach(() => {
   vi.restoreAllMocks();
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
