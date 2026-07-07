import { attributeBonus } from './attributes.js';
import { RESOURCE_KEYS, type ResourceKey } from '../data/resources.js';
import type { AttributeKey } from '../data/attributes.js';
import type { ResourceState } from '../../db/models/character.js';

// Attribute-derived resource maxes (character.md's Formulas block; the
// `recalculateMaxResources` seam CLAUDE.md's Resources section names). Pure math
// — no Discord, no DB. Constitution is the primary driver for both vitals;
// Strength and Willpower nudge Health, Willpower alone nudges Stamina, both at a
// LOWER weight than Constitution (owner's call — Constitution is the vital stat,
// the others are secondary contributors, not co-equal).
//
// 🟡 Every constant here (bases + weights) is a tunable placeholder — chosen so a
// raceless, unallocated draft (every attribute at ATTRIBUTE_BASE = 25) lands on
// the old flat defaults (Health 20 / Stamina 10), so today's placeholder combat
// numbers (duel/Spire) don't silently shift for the "average" character. Frame
// (weight/height, R12) is a documented future addend, not built here.

const HEALTH_BASE = 12;
const HEALTH_CONSTITUTION_WEIGHT = 2;
const HEALTH_STRENGTH_WEIGHT = 1;
const HEALTH_WILLPOWER_WEIGHT = 1;

const STAMINA_BASE = 4;
const STAMINA_CONSTITUTION_WEIGHT = 2;
const STAMINA_WILLPOWER_WEIGHT = 1;

/** Health pool max: Constitution-led, with a lesser Strength + Willpower nudge
 *  (a hardy grip and a stubborn will both help you keep standing). */
export function healthMax(attributes: Record<AttributeKey, number>): number {
   return Math.max(1,
      HEALTH_BASE
      + attributeBonus(attributes.constitution) * HEALTH_CONSTITUTION_WEIGHT
      + attributeBonus(attributes.strength) * HEALTH_STRENGTH_WEIGHT
      + attributeBonus(attributes.willpower) * HEALTH_WILLPOWER_WEIGHT,
   );
}

/** Stamina pool max: Constitution-led, with a lesser Willpower nudge (grit
 *  keeps you pushing after the body wants to stop). */
export function staminaMax(attributes: Record<AttributeKey, number>): number {
   return Math.max(1,
      STAMINA_BASE
      + attributeBonus(attributes.constitution) * STAMINA_CONSTITUTION_WEIGHT
      + attributeBonus(attributes.willpower) * STAMINA_WILLPOWER_WEIGHT,
   );
}

/** Both vitals' maxes for the current attribute set — the seam `setRace`/
 *  `setAttributeAllocation`/creation all recompute through. */
export function recalculateMaxResources(attributes: Record<AttributeKey, number>): Record<ResourceKey, number> {
   return { health: healthMax(attributes), stamina: staminaMax(attributes) };
}

/**
 * Applies newly-computed maxes to a resources state: a character sitting at
 * full stays full (a Constitution raise heals you up to the new cap — you got
 * hardier, not hurt), otherwise `current` is preserved but clamped down if the
 * new max fell below it. Never lets current exceed the new max.
 */
export function applyMaxResources(resources: Record<ResourceKey, ResourceState>, newMax: Record<ResourceKey, number>): Record<ResourceKey, ResourceState> {
   const updated = {} as Record<ResourceKey, ResourceState>;

   for (const key of RESOURCE_KEYS) {
      const state = resources[key];
      const max = newMax[key];
      const wasFull = state.current >= state.max;
      updated[key] = { current: wasFull ? max : Math.min(state.current, max), max };
   }

   return updated;
}
