import { describe, expect, it } from 'vitest';
import {
   CREATION_ATTRIBUTE_POINTS,
   MAX_POINTS_PER_ATTRIBUTE,
   adjustAllocation,
   allocationFrom,
   baseAttributes,
   effectiveAttributes,
   emptyAllocation,
   isAllocationComplete,
   pointsRemaining,
   pointsSpent,
} from './attributes.js';
import { ATTRIBUTE_BASE, ATTRIBUTE_KEYS } from '../data/attributes.js';
import { RACES, type RaceId } from '../data/races.js';

describe('baseAttributes', () => {
   it('is the flat baseline for a raceless character', () => {
      const base = baseAttributes(null);
      for (const key of ATTRIBUTE_KEYS)
         expect(base[key]).toBe(ATTRIBUTE_BASE);
   });

   it('applies the racial ±5 shifts', () => {
      const canid = baseAttributes('canid');
      expect(canid.strength).toBe(ATTRIBUTE_BASE + 5);
      expect(canid.willpower).toBe(ATTRIBUTE_BASE + 5);
      expect(canid.agility).toBe(ATTRIBUTE_BASE - 5);
      expect(canid.charisma).toBe(ATTRIBUTE_BASE - 5);
      expect(canid.constitution).toBe(ATTRIBUTE_BASE);
   });

   it('keeps every race net-zero (a balance invariant of the catalog)', () => {
      for (const race of Object.keys(RACES) as RaceId[]) {
         const total = Object.values(RACES[race].attributeModifiers).reduce((sum, mod) => sum + mod, 0);
         expect(total, `${race} modifiers must sum to 0`).toBe(0);
      }
   });
});

describe('adjustAllocation', () => {
   it('adds and removes points', () => {
      const one = adjustAllocation(emptyAllocation(), 'strength', 5);
      expect(one.strength).toBe(5);
      expect(adjustAllocation(one, 'strength', -1).strength).toBe(4);
   });

   it('caps a single attribute at MAX_POINTS_PER_ATTRIBUTE', () => {
      let allocation = emptyAllocation();
      allocation = adjustAllocation(allocation, 'agility', MAX_POINTS_PER_ATTRIBUTE - 2);
      allocation = adjustAllocation(allocation, 'agility', 5); // only 2 fit
      expect(allocation.agility).toBe(MAX_POINTS_PER_ATTRIBUTE);
   });

   it('never spends more than the creation pool', () => {
      let allocation = emptyAllocation();
      allocation = adjustAllocation(allocation, 'strength', 20);
      allocation = adjustAllocation(allocation, 'agility', 20);
      allocation = adjustAllocation(allocation, 'constitution', 8);
      allocation = adjustAllocation(allocation, 'perception', 5); // only 2 left
      expect(allocation.perception).toBe(2);
      expect(pointsSpent(allocation)).toBe(CREATION_ATTRIBUTE_POINTS);
      expect(isAllocationComplete(allocation)).toBe(true);
   });

   it('never goes below zero', () => {
      expect(adjustAllocation(emptyAllocation(), 'dexterity', -5).dexterity).toBe(0);
   });

   it('does not mutate the previous allocation', () => {
      const before = emptyAllocation();
      adjustAllocation(before, 'strength', 5);
      expect(before.strength).toBe(0);
   });
});

describe('effectiveAttributes', () => {
   it('is racial base + allocation', () => {
      const allocation = adjustAllocation(emptyAllocation(), 'strength', 10);
      const effective = effectiveAttributes('canid', allocation);
      expect(effective.strength).toBe(ATTRIBUTE_BASE + 5 + 10);
      expect(effective.agility).toBe(ATTRIBUTE_BASE - 5);
   });
});

describe('pointsRemaining', () => {
   it('counts down from the creation pool', () => {
      expect(pointsRemaining(emptyAllocation())).toBe(CREATION_ATTRIBUTE_POINTS);
      expect(pointsRemaining(adjustAllocation(emptyAllocation(), 'strength', 12))).toBe(CREATION_ATTRIBUTE_POINTS - 12);
   });
});

describe('allocationFrom', () => {
   it('round-trips a valid allocation', () => {
      const allocation = adjustAllocation(emptyAllocation(), 'willpower', 7);
      expect(allocationFrom(allocation)).toEqual(allocation);
   });

   it('tolerates missing/malformed blobs (old docs, test fakes)', () => {
      expect(pointsSpent(allocationFrom(undefined))).toBe(0);
      const dirty = allocationFrom({ strength: 999, agility: 'seven', dexterity: 3.9 });
      expect(dirty.strength).toBe(MAX_POINTS_PER_ATTRIBUTE); // clamped
      expect(dirty.agility).toBe(0);
      expect(dirty.dexterity).toBe(3); // floored
   });
});
