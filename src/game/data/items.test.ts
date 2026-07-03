import { describe, expect, it } from 'vitest';
import { EQUIPMENT_SLOTS } from './equipmentSlots.js';
import { ITEMS, ITEM_QUALITIES, isEquippable, itemDefinition, type ItemDefinition, type ItemId } from './items.js';

const entries = Object.entries(ITEMS) as [ItemId, ItemDefinition][];

// The catalog is data, but the inventory code relies on its invariants —
// a dangling slot id or an inverted damage range would surface as a broken
// panel at runtime, so the deploy gate (npm test) enforces them here instead
// (same stance as the location-graph tests, D21).
describe('item catalog', () => {
   it('every equippable has valid slots and positive durability', () => {
      for (const [id, def] of entries) {
         if (!isEquippable(def))
            continue;

         expect(def.slots.length, id).toBeGreaterThan(0);
         for (const slot of def.slots)
            expect(slot in EQUIPMENT_SLOTS, `${id} → ${slot}`).toBe(true);
         expect(def.durabilityMax, id).toBeGreaterThan(0);
      }
   });

   it('two-handed weapons live in the main hand only', () => {
      for (const [id, def] of entries) {
         if (def.kind === 'weapon' && def.hands === 2)
            expect(def.slots, id).toEqual(['mainHand']);
      }
   });

   it('weapon damage ranges are ordered and non-negative', () => {
      for (const [id, def] of entries) {
         if (def.kind !== 'weapon')
            continue;

         expect(def.damage.min, id).toBeGreaterThanOrEqual(0);
         expect(def.damage.max, id).toBeGreaterThanOrEqual(def.damage.min);
      }
   });

   it('weights are positive and values non-negative', () => {
      for (const [id, def] of entries) {
         expect(def.weightKg, id).toBeGreaterThan(0);
         expect(def.value, id).toBeGreaterThanOrEqual(0);
      }
   });

   it('equip requirements are positive and modifiers non-zero', () => {
      for (const [id, def] of entries) {
         if (!isEquippable(def))
            continue;

         for (const required of Object.values(def.attributeRequirements ?? {}))
            expect(required, id).toBeGreaterThan(0);
         for (const shift of Object.values(def.attributeModifiers ?? {}))
            expect(shift, id).not.toBe(0);
      }
   });

   it('consumables have at least one non-zero effect', () => {
      for (const [id, def] of entries) {
         if (def.kind !== 'consumable')
            continue;

         const effects = Object.values(def.effects);
         expect(effects.length, id).toBeGreaterThan(0);
         for (const amount of effects)
            expect(amount, id).not.toBe(0);
      }
   });

   it('quality multipliers are positive', () => {
      for (const [id, quality] of Object.entries(ITEM_QUALITIES)) {
         expect(quality.durabilityMultiplier, id).toBeGreaterThan(0);
         expect(quality.valueMultiplier, id).toBeGreaterThan(0);
      }
   });

   it('resolves known ids and tolerates unknown ones (D10 rule 3)', () => {
      expect(itemDefinition('iron_sword')).toBe(ITEMS.iron_sword);
      expect(itemDefinition('retired_relic')).toBeNull();
   });
});
