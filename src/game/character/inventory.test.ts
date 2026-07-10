import { describe, expect, it } from 'vitest';
import {
   INVENTORY_PAGE_SIZE,
   INVENTORY_STACK_LIMIT,
   attributesWithEquipment,
   browseItems,
   canAddItems,
   carriedWeightKg,
   carryCapacityKg,
   createItemInstance,
   equipmentAttributeModifiers,
   equipmentOf,
   equippedItems,
   findItem,
   findStack,
   identificationOf,
   itemDisplayName,
   itemValue,
   kindCounts,
   maxDurability,
   packBrowseState,
   parseBrowseState,
   perceivedDefinition,
   planEquip,
   planUnequip,
   qualityOf,
   resolveInventory,
   slotOfInstance,
   totalEquippedArmor,
   type EquipSubject,
   type ItemInstance,
} from './inventory.js';
import { ITEMS, type ItemQualityId } from '../data/items.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';

function attributes(overrides: Partial<Record<AttributeKey, number>> = {}): Record<AttributeKey, number> {
   return {
      ...Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 25])) as Record<AttributeKey, number>,
      strength: 30,
      ...overrides,
   };
}

function instance(instanceId: string, itemId: string, overrides: Partial<ItemInstance> = {}): ItemInstance {
   return { instanceId, itemId, quality: 'common', quantity: 1, acquiredAt: new Date('2026-07-01'), ...overrides };
}

function subject(inventory: ItemInstance[] = [], equipment: Partial<Record<string, string>> = {}, attrs: Partial<Record<AttributeKey, number>> = {}): EquipSubject {
   return { inventory, equipment, attributes: attributes(attrs) };
}

describe('reading the pack', () => {
   it('tolerates pre-inventory docs (missing fields)', () => {
      expect(resolveInventory({})).toEqual([]);
      expect(equipmentOf({})).toEqual({});
      expect(carriedWeightKg({})).toBe(0);
   });

   it('drops unknown item ids from view but keeps known ones (D10 rule 3)', () => {
      const character = subject([instance('a', 'iron_sword'), instance('b', 'retired_relic')]);
      const resolved = resolveInventory(character);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].instance.instanceId).toBe('a');
      expect(findItem(character, 'b')).toBeNull();
   });

   it('filters unknown slot ids out of the equipment map', () => {
      const character = subject([instance('a', 'iron_sword')], { mainHand: 'a', tail: 'a' });
      expect(equipmentOf(character)).toEqual({ mainHand: 'a' });
   });

   it('falls back to common for a stale stored quality', () => {
      expect(qualityOf(instance('a', 'iron_sword', { quality: 'legendary' as ItemQualityId }))).toBe('common');
   });
});

describe('display & quality scaling', () => {
   it('prefixes the name with the craftsmanship tier', () => {
      const character = subject([instance('a', 'iron_sword', { quality: 'poor' }), instance('b', 'iron_sword')]);
      expect(itemDisplayName(findItem(character, 'a')!)).toBe('Battered Iron Sword');
      expect(itemDisplayName(findItem(character, 'b')!)).toBe('Iron Sword');
   });

   it('scales durability and value by quality', () => {
      expect(maxDurability(ITEMS.iron_sword, 'fine')).toBe(90);
      expect(maxDurability(ITEMS.travel_rations, 'fine')).toBeNull();

      const character = subject([instance('a', 'iron_sword', { quality: 'masterwork' })]);
      expect(itemValue(findItem(character, 'a')!)).toBe(360);
   });
});

describe('identification (R16)', () => {
   const veiled = (overrides: Partial<ItemInstance> = {}) =>
      instance('m', 'ashgill_fungus', { identified: false, descriptorId: 'amber_capped', ...overrides });

   it('reads the three states off the optional fields (absent = identified)', () => {
      expect(identificationOf(instance('a', 'iron_sword'))).toBe('identified');
      expect(identificationOf(veiled())).toBe('unidentified');
      expect(identificationOf(veiled({ apparentItemId: 'honeycap_mushroom' }))).toBe('mislabeled');
   });

   it('shows an unknown by its capitalized look, never its true name', () => {
      const character = subject([veiled()]);
      const item = findItem(character, 'm')!;

      expect(itemDisplayName(item)).toBe('An amber-capped mushroom');
      expect(itemValue(item)).toBe(0); // worth nothing to anyone yet
   });

   it('a mislabel renders the WRONG item wholesale — name, value, description', () => {
      const character = subject([veiled({ apparentItemId: 'honeycap_mushroom', quality: 'masterwork' })]);
      const item = findItem(character, 'm')!;

      expect(perceivedDefinition(item).name).toBe('Honeycap Mushroom');
      expect(itemDisplayName(item)).toBe('Pristine Honeycap Mushroom');
      expect(itemValue(item)).toBe(Math.round(ITEMS.honeycap_mushroom.value * 6)); // apparent value × masterwork
   });

   it('a stale apparent id degrades to the truth (D10 rule 3)', () => {
      const character = subject([veiled({ apparentItemId: 'retired_plant' })]);
      expect(perceivedDefinition(findItem(character, 'm')!).name).toBe('Ashgill Fungus');
   });

   it('a stale descriptor id still shows at least the coarse family', () => {
      const character = subject([veiled({ descriptorId: 'retired_look' })]);
      expect(itemDisplayName(findItem(character, 'm')!)).toBe('An unfamiliar mushroom');
   });

   it('foraged finds use their own family quality names, gear keeps its own (R23)', () => {
      const character = subject([
         instance('herb', 'silverleaf', { quality: 'masterwork' }),
         instance('sword', 'iron_sword', { quality: 'masterwork' }),
      ]);

      expect(itemDisplayName(findItem(character, 'herb')!)).toBe('Pristine Silverleaf');
      expect(itemDisplayName(findItem(character, 'sword')!)).toBe('Masterwork Iron Sword');
   });

   it('mysteries never merge: not a stack target, and mystery grants never stack', () => {
      const character = subject([veiled({ itemId: 'stingweed' })], {}, { strength: 100 });

      // An identified grant must not launder into the veiled instance…
      expect(findStack(character, 'stingweed', 'common')).toBeNull();
      // …and a mystery grant must not merge into an identified stack.
      const withStack = subject([instance('s', 'stingweed', { quantity: 3 })], {}, { strength: 100 });
      expect(canAddItems(withStack, 'stingweed', ITEMS.stingweed, 'common', 1, true)).toMatchObject({ ok: true, stackWith: null });
   });

   it('mints a veiled instance from mystery fields', () => {
      const minted = createItemInstance('ashgill_fungus', ITEMS.ashgill_fungus, 'common', 1, new Set(), { descriptorId: 'amber_capped', apparentItemId: 'honeycap_mushroom' });

      expect(minted.identified).toBe(false);
      expect(minted.descriptorId).toBe('amber_capped');
      expect(minted.apparentItemId).toBe('honeycap_mushroom');
   });
});

describe('weight & adding items', () => {
   it('sums stack weights and derives capacity from strength', () => {
      const character = subject([instance('a', 'iron_ingot', { quantity: 5 }), instance('b', 'iron_sword')]);
      expect(carriedWeightKg(character)).toBeCloseTo(11.3);
      expect(carryCapacityKg({ attributes: attributes({ strength: 42 }) })).toBe(42);
   });

   it('merges stackables by item AND quality', () => {
      const character = subject([instance('a', 'travel_rations', { quantity: 3 }), instance('b', 'travel_rations', { quality: 'fine' })]);

      expect(findStack(character, 'travel_rations', 'common')?.instanceId).toBe('a');
      expect(findStack(character, 'travel_rations', 'fine')?.instanceId).toBe('b');
      expect(findStack(character, 'iron_sword', 'common')).toBeNull();
   });

   it('refuses new entries past the stack limit but still merges into stacks', () => {
      const stacks = Array.from({ length: INVENTORY_STACK_LIMIT - 1 }, (_, i) => instance(`c${i}`, 'smooth_river_stone', { quantity: 1 }));
      const character = subject([...stacks, instance('food', 'travel_rations')], {}, { strength: 100 });

      expect(canAddItems(character, 'iron_sword', ITEMS.iron_sword, 'common', 1).ok).toBe(false);
      expect(canAddItems(character, 'travel_rations', ITEMS.travel_rations, 'common', 5)).toMatchObject({ ok: true });
   });

   it('counts each non-stackable unit against the stack limit', () => {
      const stacks = Array.from({ length: INVENTORY_STACK_LIMIT - 2 }, (_, i) => instance(`c${i}`, 'smooth_river_stone'));
      const character = subject(stacks, {}, { strength: 100 });

      expect(canAddItems(character, 'iron_sword', ITEMS.iron_sword, 'common', 2).ok).toBe(true);
      expect(canAddItems(character, 'iron_sword', ITEMS.iron_sword, 'common', 3).ok).toBe(false);
   });

   it('refuses weight past carry capacity', () => {
      const character = subject([], {}, { strength: 25 });
      expect(canAddItems(character, 'iron_ingot', ITEMS.iron_ingot, 'common', 12).ok).toBe(true);
      expect(canAddItems(character, 'iron_ingot', ITEMS.iron_ingot, 'common', 13)).toEqual({ ok: false, reason: 'too-heavy' });
   });

   it('mints instances with fresh short ids and quality-scaled durability', () => {
      const existing = new Set(['aaaaaaaa']);
      const minted = createItemInstance('iron_sword', ITEMS.iron_sword, 'fine', 1, existing);

      expect(minted.instanceId).toHaveLength(8);
      expect(existing.has(minted.instanceId)).toBe(false);
      expect(minted.durability).toBe(90);

      const rations = createItemInstance('travel_rations', ITEMS.travel_rations, 'common', 7, existing);
      expect(rations.quantity).toBe(7);
      expect(rations.durability).toBeUndefined();
   });
});

describe('equipping', () => {
   it('plans a simple equip into a legal slot', () => {
      const character = subject([instance('a', 'iron_sword')]);
      const check = planEquip(character, 'a', 'mainHand');

      expect(check).toMatchObject({ ok: true, plan: { set: { mainHand: 'a' }, clear: [], displaced: [] } });
   });

   it('rejects the wrong slot, non-gear, and missing items', () => {
      const character = subject([instance('a', 'iron_sword'), instance('b', 'travel_rations')]);

      expect(planEquip(character, 'a', 'head')).toMatchObject({ ok: false, reason: 'wrong-slot' });
      expect(planEquip(character, 'b', 'mainHand')).toMatchObject({ ok: false, reason: 'not-equippable' });
      expect(planEquip(character, 'ghost', 'mainHand')).toMatchObject({ ok: false, reason: 'not-found' });
   });

   it('rejects gear beyond the character\'s attributes, with details', () => {
      const character = subject([instance('a', 'war_maul')], {}, { strength: 30 });
      const check = planEquip(character, 'a', 'mainHand');

      expect(check).toMatchObject({ ok: false, reason: 'requirements' });
      if (!check.ok)
         expect(check.unmet).toEqual([{ attribute: 'strength', required: 40, actual: 30 }]);
   });

   it('rejects broken gear', () => {
      const character = subject([instance('a', 'iron_sword', { durability: 0 })]);
      expect(planEquip(character, 'a', 'mainHand')).toMatchObject({ ok: false, reason: 'broken' });
   });

   it('a two-handed weapon vacates the off hand', () => {
      const character = subject(
         [instance('maul', 'war_maul'), instance('shield', 'wooden_buckler')],
         { offHand: 'shield' },
         { strength: 45 },
      );
      const check = planEquip(character, 'maul', 'mainHand');

      expect(check.ok).toBe(true);
      if (check.ok) {
         expect(check.plan.set).toEqual({ mainHand: 'maul' });
         expect(check.plan.clear).toEqual(['offHand']);
         expect(check.plan.displaced.map((d) => d.instance.instanceId)).toEqual(['shield']);
      }
   });

   it('blocks the off hand while a two-handed weapon is wielded', () => {
      const character = subject(
         [instance('maul', 'war_maul'), instance('shield', 'wooden_buckler')],
         { mainHand: 'maul' },
         { strength: 45 },
      );

      expect(planEquip(character, 'shield', 'offHand')).toMatchObject({ ok: false, reason: 'hands-full' });
   });

   it('moving an equipped item frees its old slot; swaps displace the occupant', () => {
      const character = subject(
         [instance('dagger', 'iron_dagger'), instance('sword', 'iron_sword')],
         { mainHand: 'dagger' },
      );

      const move = planEquip(character, 'dagger', 'offHand');
      expect(move.ok).toBe(true);
      if (move.ok)
         expect(move.plan).toMatchObject({ set: { offHand: 'dagger' }, clear: ['mainHand'] });

      const swap = planEquip(character, 'sword', 'mainHand');
      expect(swap.ok).toBe(true);
      if (swap.ok) {
         expect(swap.plan.clear).toEqual([]);
         expect(swap.plan.displaced.map((d) => d.instance.instanceId)).toEqual(['dagger']);
      }
   });

   it('plans unequips only for worn gear', () => {
      const character = subject([instance('a', 'iron_sword')], { mainHand: 'a' });

      expect(planUnequip(character, 'a')).toMatchObject({ ok: true, slot: 'mainHand' });
      expect(planUnequip({ ...character, equipment: {} }, 'a')).toEqual({ ok: false, reason: 'not-equipped' });
   });
});

describe('worn gear effects', () => {
   const character = subject(
      [instance('plate', 'steel_breastplate'), instance('helm', 'steel_helm'), instance('sword', 'iron_sword')],
      { chest: 'plate', head: 'helm', mainHand: 'sword' },
      { strength: 40, agility: 8 },
   );

   it('lists equipped items in slot order and sums armor', () => {
      expect(equippedItems(character).map((entry) => entry.slot)).toEqual(['mainHand', 'head', 'chest']);
      expect(slotOfInstance(character, 'plate')).toBe('chest');
      expect(totalEquippedArmor(character)).toBe(5);
   });

   it('sums attribute modifiers across gear and floors effective values at 1', () => {
      expect(equipmentAttributeModifiers(character)).toEqual({ agility: -10, dexterity: -5, perception: -5 });

      const effective = attributesWithEquipment(character);
      expect(effective.agility).toBe(1); // 8 − 10, floored
      expect(effective.dexterity).toBe(20);
      expect(effective.strength).toBe(40);
   });
});

describe('browsing', () => {
   it('round-trips browse state and falls back field by field', () => {
      expect(parseBrowseState(packBrowseState({ kind: 'armor', sort: 'weight', page: 3 }))).toEqual({ kind: 'armor', sort: 'weight', page: 3 });
      expect(parseBrowseState('armor')).toEqual({ kind: 'armor', sort: 'name', page: 0 });
      expect(parseBrowseState('nonsense.bogus.-2')).toEqual({ kind: 'weapon', sort: 'name', page: 0 });
      expect(parseBrowseState(undefined)).toEqual({ kind: 'weapon', sort: 'name', page: 0 });
   });

   it('filters by category, sorts, and clamps the page', () => {
      const swords = Array.from({ length: INVENTORY_PAGE_SIZE + 2 }, (_, i) => instance(`s${i}`, 'iron_sword'));
      const character = subject([...swords, instance('food', 'travel_rations')]);

      const first = browseItems(character, { kind: 'weapon', sort: 'name', page: 0 });
      expect(first.totalCount).toBe(INVENTORY_PAGE_SIZE + 2);
      expect(first.items).toHaveLength(INVENTORY_PAGE_SIZE);
      expect(first.pageCount).toBe(2);

      const strayPage = browseItems(character, { kind: 'weapon', sort: 'name', page: 9 });
      expect(strayPage.page).toBe(1);
      expect(strayPage.items).toHaveLength(2);

      expect(browseItems(character, { kind: 'consumable', sort: 'name', page: 0 }).totalCount).toBe(1);
   });

   it('sorts by weight (heaviest stack first) and by newest', () => {
      const character = subject([
         instance('light', 'iron_dagger'),
         instance('heavy', 'war_maul'),
         instance('old', 'iron_sword', { acquiredAt: new Date('2026-01-01') }),
      ]);

      const byWeight = browseItems(character, { kind: 'weapon', sort: 'weight', page: 0 });
      expect(byWeight.items[0].instance.instanceId).toBe('heavy');

      const byNewest = browseItems(character, { kind: 'weapon', sort: 'newest', page: 0 });
      expect(byNewest.items.at(-1)?.instance.instanceId).toBe('old');
   });

   it('counts stacks per category', () => {
      const character = subject([instance('a', 'iron_sword'), instance('b', 'travel_rations', { quantity: 9 }), instance('c', 'bent_spoon')]);
      const counts = kindCounts(character);

      expect(counts.weapon).toBe(1);
      expect(counts.consumable).toBe(1);
      expect(counts.clutter).toBe(1);
      expect(counts.armor).toBe(0);
   });
});
