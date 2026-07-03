import { afterEach, describe, expect, it, vi } from 'vitest';
import { eligibleEncounters, rollTravelEncounter } from './encounters.js';
import { ENCOUNTERS } from '../data/encounters.js';

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
