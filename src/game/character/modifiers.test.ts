import { describe, expect, it } from 'vitest';
import { activeEffects, attributeShifts, checkBonus, checkSubject, modifiedAttributes, modifierSources, type ModifierSubject } from './modifiers.js';
import { checkTarget } from '../checks.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';
import type { ItemInstance } from './inventory.js';

const NOW = new Date('2026-11-11T12:00:00Z');
const LATER = new Date('2026-11-11T13:00:00Z');
const EARLIER = new Date('2026-11-11T11:00:00Z');

function character(overrides: Partial<ModifierSubject> = {}): ModifierSubject {
   return {
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 25])) as Record<AttributeKey, number>,
      inventory: [],
      equipment: {},
      ...overrides,
   };
}

const plate: ItemInstance = { instanceId: 'plate', itemId: 'steel_breastplate', quality: 'common', quantity: 1, acquiredAt: NOW };
const armoured = { inventory: [plate], equipment: { chest: 'plate' } };

describe('activeEffects', () => {
   it('keeps running effects and skips expired or unknown ones', () => {
      const subject = character({
         effects: [
            { effectId: 'dutch_courage', expiresAt: LATER },
            { effectId: 'dutch_courage', expiresAt: EARLIER },
            { effectId: 'retired_effect', expiresAt: LATER },
         ],
      });

      expect(activeEffects(subject, NOW).map((effect) => effect.effectId)).toEqual(['dutch_courage']);
   });

   it('tolerates a character with no effects field', () => {
      expect(activeEffects(character(), NOW)).toEqual([]);
   });
});

describe('modifierSources', () => {
   it('lists gear and effects as separate labelled sources', () => {
      const subject = character({ ...armoured, effects: [{ effectId: 'dutch_courage', expiresAt: LATER }] });

      expect(modifierSources(subject, { now: NOW }).map((source) => [source.kind, source.label])).toEqual([
         ['gear', 'Equipment'],
         ['effect', 'Dutch Courage'],
      ]);
   });

   it('leaves gear out when it is set aside, but keeps effects', () => {
      const subject = character({ ...armoured, effects: [{ effectId: 'dutch_courage', expiresAt: LATER }] });

      expect(modifierSources(subject, { gear: false, now: NOW }).map((source) => source.kind)).toEqual(['effect']);
   });

   it('is empty for an unmodified character', () => {
      expect(modifierSources(character(), { now: NOW })).toEqual([]);
   });
});

describe('attribute shifts', () => {
   it('sums shifts on the same attribute across sources', () => {
      const shifts = attributeShifts([
         { kind: 'gear', label: 'a', attributes: { agility: -10, perception: -5 } },
         { kind: 'effect', label: 'b', attributes: { perception: -5, willpower: 5 } },
      ]);

      expect(shifts).toEqual({ agility: -10, perception: -10, willpower: 5 });
   });

   it('applies them to the base and floors at 1', () => {
      const subject = character({
         attributes: { ...character().attributes, perception: 3 },
         effects: [{ effectId: 'dutch_courage', expiresAt: LATER }],
      });

      const modified = modifiedAttributes(subject, { now: NOW });
      expect(modified.willpower).toBe(30);
      expect(modified.perception).toBe(1);
      expect(modified.strength).toBe(25);
   });
});

describe('checkSubject', () => {
   it('carries modified attributes and the summed flat bonus into a check', () => {
      const base = { ...character(), identity: { race: null }, progression: { skills: {} } };
      const plain = checkSubject(base, { now: NOW });
      expect(plain.checkBonus).toBe(0);
      expect(checkTarget(plain, { attribute: 'willpower' })).toBe(25);

      const drunk = checkSubject({ ...base, effects: [{ effectId: 'dutch_courage', expiresAt: LATER }] }, { now: NOW });
      expect(checkTarget(drunk, { attribute: 'willpower' })).toBe(30);
      expect(checkTarget(drunk, { attribute: 'perception' })).toBe(20);
   });

   it('adds a flat check bonus to the target', () => {
      expect(checkBonus([{ kind: 'effect', label: 'a', checkBonus: 10 }, { kind: 'effect', label: 'b', checkBonus: -4 }])).toBe(6);

      const subject = { ...character(), identity: { race: null }, progression: { skills: {} }, checkBonus: 6 };
      expect(checkTarget(subject, { attribute: 'strength' })).toBe(31);
   });
});
