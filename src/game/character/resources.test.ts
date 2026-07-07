import { describe, expect, it } from 'vitest';
import { applyMaxResources, healthMax, recalculateMaxResources, staminaMax } from './resources.js';
import { effectiveAttributes, emptyAllocation } from './attributes.js';
import { ATTRIBUTE_BASE } from '../data/attributes.js';

const NEUTRAL = effectiveAttributes(null, emptyAllocation()); // every attribute = ATTRIBUTE_BASE

describe('healthMax / staminaMax', () => {
   it('matches the old flat defaults at neutral (raceless, unallocated) attributes', () => {
      expect(healthMax(NEUTRAL)).toBe(20);
      expect(staminaMax(NEUTRAL)).toBe(10);
   });

   it('Constitution moves Health further than an equal Strength/Willpower change', () => {
      const conUp = { ...NEUTRAL, constitution: ATTRIBUTE_BASE + 10 };
      const strUp = { ...NEUTRAL, strength: ATTRIBUTE_BASE + 10 };
      const wilUp = { ...NEUTRAL, willpower: ATTRIBUTE_BASE + 10 };

      const baseline = healthMax(NEUTRAL);
      const conGain = healthMax(conUp) - baseline;
      const strGain = healthMax(strUp) - baseline;
      const wilGain = healthMax(wilUp) - baseline;

      expect(conGain).toBeGreaterThan(strGain);
      expect(conGain).toBeGreaterThan(wilGain);
      expect(strGain).toBeGreaterThan(0);
      expect(wilGain).toBeGreaterThan(0);
   });

   it('Constitution moves Stamina further than an equal Willpower change, Strength does not move it at all', () => {
      const conUp = { ...NEUTRAL, constitution: ATTRIBUTE_BASE + 10 };
      const wilUp = { ...NEUTRAL, willpower: ATTRIBUTE_BASE + 10 };
      const strUp = { ...NEUTRAL, strength: ATTRIBUTE_BASE + 10 };

      const baseline = staminaMax(NEUTRAL);
      const conGain = staminaMax(conUp) - baseline;
      const wilGain = staminaMax(wilUp) - baseline;

      expect(conGain).toBeGreaterThan(wilGain);
      expect(wilGain).toBeGreaterThan(0);
      expect(staminaMax(strUp)).toBe(baseline);
   });

   it('never drops to 0 or below even at rock-bottom attributes', () => {
      const gutted = { ...NEUTRAL, constitution: 1, strength: 1, willpower: 1 };
      expect(healthMax(gutted)).toBeGreaterThanOrEqual(1);
      expect(staminaMax(gutted)).toBeGreaterThanOrEqual(1);
   });
});

describe('recalculateMaxResources', () => {
   it('bundles both vitals', () => {
      expect(recalculateMaxResources(NEUTRAL)).toEqual({ health: 20, stamina: 10 });
   });
});

describe('applyMaxResources', () => {
   it('keeps a full character full on the new (higher) cap', () => {
      const resources = { health: { current: 20, max: 20 }, stamina: { current: 10, max: 10 } };
      const updated = applyMaxResources(resources, { health: 25, stamina: 12 });
      expect(updated.health).toEqual({ current: 25, max: 25 });
      expect(updated.stamina).toEqual({ current: 12, max: 12 });
   });

   it('preserves a damaged character\'s current value when the cap rises', () => {
      const resources = { health: { current: 5, max: 20 }, stamina: { current: 10, max: 10 } };
      const updated = applyMaxResources(resources, { health: 25, stamina: 10 });
      expect(updated.health).toEqual({ current: 5, max: 25 });
   });

   it('clamps current down if the new cap falls below it', () => {
      const resources = { health: { current: 20, max: 20 }, stamina: { current: 10, max: 10 } };
      const updated = applyMaxResources(resources, { health: 15, stamina: 10 });
      expect(updated.health).toEqual({ current: 15, max: 15 }); // was full, so it also stays full
   });

   it('leaves a damaged character\'s current untouched when the new cap still clears it', () => {
      const resources = { health: { current: 10, max: 20 }, stamina: { current: 10, max: 10 } };
      const updated = applyMaxResources(resources, { health: 15, stamina: 10 });
      expect(updated.health).toEqual({ current: 10, max: 15 }); // NOT healed to 15 — it wasn't full before
   });
});
