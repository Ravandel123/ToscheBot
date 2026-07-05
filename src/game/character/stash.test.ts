import { describe, expect, it } from 'vitest';
import {
   DEFAULT_STASH_SORT,
   canWithdrawInto,
   itemIdsOfKind,
   packStashState,
   parseStashState,
   resolveStashInstance,
   stashBrowseState,
   tallyKinds,
} from './stash.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';
import { ITEMS } from '../data/items.js';
import type { EquipSubject, ItemInstance } from './inventory.js';

function attributes(overrides: Partial<Record<AttributeKey, number>> = {}): Record<AttributeKey, number> {
   return {
      ...Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 25])) as Record<AttributeKey, number>,
      strength: 30, // carry capacity = strength kg (placeholder, D28)
      ...overrides,
   };
}

function instance(instanceId: string, itemId: string, overrides: Partial<ItemInstance> = {}): ItemInstance {
   return { instanceId, itemId, quality: 'common', quantity: 1, acquiredAt: new Date('2026-07-01'), ...overrides };
}

function subject(inventory: ItemInstance[] = [], attrs: Partial<Record<AttributeKey, number>> = {}): EquipSubject {
   return { inventory, equipment: {}, attributes: attributes(attrs) };
}

describe('stash browse state', () => {
   it('round-trips container/kind/sort/page through pack + parse', () => {
      const state = stashBrowseState('home_chest', 'shield', 'oldest', 3);
      expect(parseStashState(packStashState(state))).toEqual(state);
   });

   it('falls back field-by-field on stale or missing values', () => {
      expect(parseStashState(undefined)).toEqual(stashBrowseState('home_chest', 'weapon', DEFAULT_STASH_SORT, 0));
      expect(parseStashState('bogus.nope.wrong.-4')).toEqual(stashBrowseState('home_chest', 'weapon', DEFAULT_STASH_SORT, 0));
   });
});

describe('canWithdrawInto', () => {
   it('allows a withdrawal that fits the pack and the carry limit', () => {
      expect(canWithdrawInto(subject(), ITEMS.iron_sword, 1)).toEqual({ ok: true });
   });

   it('refuses when the pack is already at the entry cap (checked before weight)', () => {
      const packed = Array.from({ length: 50 }, (_, i) => instance(`s${i}`, 'bent_spoon'));
      expect(canWithdrawInto(subject(packed), ITEMS.bent_spoon, 1)).toEqual({ ok: false, reason: 'inventory-full' });
   });

   it('refuses when the withdrawn weight would exceed carry capacity', () => {
      const packed = [instance('a', 'mail_shirt'), instance('b', 'mail_shirt'), instance('c', 'mail_shirt')]; // 27 kg
      expect(canWithdrawInto(subject(packed), ITEMS.iron_kite_shield, 1)).toEqual({ ok: false, reason: 'too-heavy' });
   });

   it('counts the whole stack weight for a stackable withdrawal', () => {
      // 10 rations at 0.5 kg = 5 kg fits under 30; 70 would not.
      expect(canWithdrawInto(subject(), ITEMS.travel_rations, 10)).toEqual({ ok: true });
      expect(canWithdrawInto(subject(), ITEMS.travel_rations, 70)).toEqual({ ok: false, reason: 'too-heavy' });
   });
});

describe('tallyKinds', () => {
   it('rolls up itemId counts into catalog kinds and ignores unknown ids', () => {
      const counts = tallyKinds([
         { itemId: 'iron_sword', count: 2 },
         { itemId: 'iron_dagger', count: 1 },
         { itemId: 'wooden_buckler', count: 4 },
         { itemId: 'retired_relic', count: 9 },
      ]);

      expect(counts.weapon).toBe(3);
      expect(counts.shield).toBe(4);
      expect(counts.armor).toBe(0);
      expect(counts.consumable).toBe(0);
   });
});

describe('itemIdsOfKind', () => {
   it('returns exactly the catalog ids of that kind', () => {
      const weapons = itemIdsOfKind('weapon');
      expect(weapons).toContain('iron_sword');
      expect(weapons).not.toContain('wooden_buckler');
      expect(weapons.every((id) => ITEMS[id as keyof typeof ITEMS].kind === 'weapon')).toBe(true);
   });
});

describe('resolveStashInstance', () => {
   it('pairs a known instance with its definition', () => {
      const resolved = resolveStashInstance(instance('x', 'iron_sword'));
      expect(resolved?.definition.name).toBe('Iron Sword');
   });

   it('drops an unknown item id (D10 rule 3)', () => {
      expect(resolveStashInstance(instance('x', 'retired_relic'))).toBeNull();
   });
});
