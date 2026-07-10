import { afterEach, describe, expect, it, vi } from 'vitest';
import {
   MAX_GATHER_YIELD,
   gatherQuantity,
   groupYields,
   noteworthyYields,
   professionNodeAt,
   qualityFromCheck,
   resolveGather,
   yieldDisplayName,
   type GatherYield,
} from './gather.js';
import { checkTarget } from '../checks.js';
import { identifyCheck } from './identify.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';
import type { CheckSubject } from '../checks.js';
import type { ResourceNodeDefinition } from '../data/resourceNodes.js';

// Pure gather-engine tests: quantity-from-SL, quality-from-surplus and the
// one-roll identify sweep, with Math.random mocked (the codebase pattern).

afterEach(() => vi.restoreAllMocks());

function subject(value = 50): CheckSubject {
   return {
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, value])) as Record<AttributeKey, number>,
      progression: { skills: {} },
      identity: { race: null },
   };
}

// A single-item table makes the weightedItem pick deterministic regardless of
// the mocked randomness; stingweed is the easy-to-recognize test plant (+20).
const TEST_NODE: ResourceNodeDefinition = {
   name: 'the test greens',
   profession: 'foraging',
   skillNode: 'foraging',
   difficulty: 0,
   table: [['stingweed', 1]],
   emptyLine: 'nothing here',
};

describe('gatherQuantity', () => {
   it('yields 1 at a scrape and one more per 2 SL, capped', () => {
      expect(gatherQuantity(0)).toBe(1);
      expect(gatherQuantity(1)).toBe(1);
      expect(gatherQuantity(2)).toBe(2);
      expect(gatherQuantity(5)).toBe(3);
      expect(gatherQuantity(99)).toBe(MAX_GATHER_YIELD);
      expect(gatherQuantity(-3)).toBe(1); // defensive — callers pass successes
   });
});

describe('qualityFromCheck (the shared surplus→quality model)', () => {
   it('bands the SL −2..+1 jitter into the four tiers', () => {
      const jitter = (value: number) => vi.spyOn(Math, 'random').mockReturnValue(value);

      jitter(0); // randomInt(-2, 1) → -2
      expect(qualityFromCheck(0)).toBe('poor');
      expect(qualityFromCheck(2)).toBe('common');
      expect(qualityFromCheck(6)).toBe('fine');
      expect(qualityFromCheck(10)).toBe('masterwork'); // even the worst jitter can't sink SL 10

      jitter(0.99); // → +1
      expect(qualityFromCheck(0)).toBe('common');
      expect(qualityFromCheck(3)).toBe('fine');
      expect(qualityFromCheck(7)).toBe('masterwork');
   });
});

describe('resolveGather', () => {
   it('a failed check yields nothing but still weighs the gather training', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // d100 = 100 — always fails
      const resolution = resolveGather(subject(), TEST_NODE);

      expect(resolution.check.success).toBe(false);
      expect(resolution.yields).toEqual([]);
      expect(resolution.gatherTrainingWeight).toBeGreaterThan(0);
      expect(resolution.identifyTrainingWeight).toBeNull();
   });

   it('a success yields SL-scaled units, all recognized when the sweep roll is low', () => {
      // Attributes 50 → foraging target 30 (0.3 INT + 0.3 PER). random 0 →
      // gather roll 1 (SL 3 → 2 units), identify roll 1 → under every target.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const resolution = resolveGather(subject(), TEST_NODE);

      expect(resolution.check.success).toBe(true);
      expect(resolution.yields).toHaveLength(2);
      for (const yielded of resolution.yields) {
         expect(yielded.itemId).toBe('stingweed');
         expect(yielded.mystery).toBeNull();
      }
      expect(resolution.identifyTrainingWeight).not.toBeNull();
   });

   it('a high sweep roll veils the haul with descriptors from the item\'s looks', () => {
      // 1st random: gather roll (0.05 → 6, success, SL 3 − 0 = 3 → 2 units);
      // 2nd: identify roll (0.99 → 100 — over every target); then per unit:
      // table pick, descriptor pick, mislabel chance (0.99 → no mislabel).
      vi.spyOn(Math, 'random')
         .mockReturnValueOnce(0.05)
         .mockReturnValue(0.99);
      const resolution = resolveGather(subject(), TEST_NODE);

      expect(resolution.yields.length).toBeGreaterThan(0);
      for (const yielded of resolution.yields) {
         expect(yielded.mystery).not.toBeNull();
         expect(['ragged_nettle', 'silvery_leaved']).toContain(yielded.mystery?.descriptorId);
         expect(yielded.mystery?.apparentItemId).toBeUndefined();
      }
      // One sweep credits one use regardless of haul size, weighted by the mean target.
      expect(resolution.identifyTrainingWeight).toBeGreaterThan(0);
   });

   it('race affinity shifts the gather target like any other check', () => {
      const node: ResourceNodeDefinition = { ...TEST_NODE, raceAffinity: { lutren: 1.5 } };
      const lutren = { ...subject(), identity: { race: 'lutren' as const } };

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const plain = resolveGather(subject(), node);
      const gifted = resolveGather(lutren, node);

      expect(gifted.check.target).toBeGreaterThan(plain.check.target);
   });
});

describe('groupYields', () => {
   const identified = (quality: GatherYield['quality']): GatherYield => ({ itemId: 'stingweed', quality, mystery: null });
   const mystery = (): GatherYield => ({ itemId: 'stingweed', quality: 'common', mystery: { descriptorId: 'ragged_nettle' } });

   it('stacks recognized finds by item + quality, keeps every mystery separate', () => {
      const orders = groupYields([identified('common'), identified('common'), identified('fine'), mystery(), mystery()]);

      expect(orders).toHaveLength(4);
      expect(orders[0]).toMatchObject({ itemId: 'stingweed', quality: 'common', quantity: 2, mystery: null });
      expect(orders[1]).toMatchObject({ quality: 'fine', quantity: 1 });
      expect(orders.filter((order) => order.mystery !== null)).toHaveLength(2);
   });
});

describe('yieldDisplayName (what the forager BELIEVES they picked)', () => {
   it('names a recognized find with its family quality prefix', () => {
      expect(yieldDisplayName({ itemId: 'silverleaf', quality: 'masterwork', mystery: null })).toBe('Pristine Silverleaf');
      expect(yieldDisplayName({ itemId: 'silverleaf', quality: 'common', mystery: null })).toBe('Silverleaf');
   });

   it('names a confident mislabel as the WRONG item', () => {
      expect(yieldDisplayName({ itemId: 'ashgill_fungus', quality: 'common', mystery: { descriptorId: 'amber_capped', apparentItemId: 'honeycap_mushroom' } }))
         .toBe('Honeycap Mushroom');
   });

   it('names an honest unknown by its capitalized look', () => {
      expect(yieldDisplayName({ itemId: 'ashgill_fungus', quality: 'common', mystery: { descriptorId: 'grey_gilled' } }))
         .toBe('A grey-gilled toadstool');
   });
});

describe('noteworthyYields (chronicle gate, D24)', () => {
   it('reports only recognized rarities or pristine specimens', () => {
      const yields: GatherYield[] = [
         { itemId: 'silverleaf', quality: 'common', mystery: null }, // noteworthy species
         { itemId: 'stingweed', quality: 'masterwork', mystery: null }, // pristine specimen
         { itemId: 'stingweed', quality: 'common', mystery: null }, // mundane
         { itemId: 'silverleaf', quality: 'common', mystery: { descriptorId: 'silvery_leaved' } }, // unknown rarity — nobody knows
      ];

      expect(noteworthyYields(yields)).toHaveLength(2);
   });
});

describe('professionNodeAt', () => {
   it('finds the foraging node where locations declare one, and nowhere else', () => {
      expect(professionNodeAt('riverbank', 'foraging')?.id).toBe('riverbank_greens');
      expect(professionNodeAt('tanglewood', 'foraging')?.id).toBe('woodland_undergrowth');
      expect(professionNodeAt('plaza', 'foraging')).toBeNull();
      expect(professionNodeAt('atlantis', 'foraging')).toBeNull(); // unknown id → starting location (no nodes)
   });
});

describe('identify targets are honest checks', () => {
   it('per-item modifiers shift the target through the shared engine', () => {
      const easy = checkTarget(subject(), identifyCheck('stingweed'));
      const hard = checkTarget(subject(), identifyCheck('ashgill_fungus'));
      expect(easy).toBeGreaterThan(hard);
   });
});
