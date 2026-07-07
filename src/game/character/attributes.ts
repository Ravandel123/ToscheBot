import { ATTRIBUTE_BASE, ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';
import { RACES, type RaceId } from '../data/races.js';

// Pure attribute math — no Discord, no DB. A character's effective attribute is
// always `racial base + creation allocation`; the stored `attributes` map is a
// cache of that sum, recomputed by characterService whenever race or allocation
// changes (same "stored, not derived on read" stance as resource max).

/** Points a new character distributes across attributes during creation. 🟡 tunable. */
export const CREATION_ATTRIBUTE_POINTS = 50;
/** Cap on how many creation points may land on ONE attribute. 🟡 tunable. */
export const MAX_POINTS_PER_ATTRIBUTE = 20;

export type AttributeAllocation = Record<AttributeKey, number>;

export function emptyAllocation(): AttributeAllocation {
   return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])) as AttributeAllocation;
}

/** Reads an allocation off a doc/blob, tolerating missing or malformed fields. */
export function allocationFrom(raw: Partial<Record<AttributeKey, unknown>> | undefined): AttributeAllocation {
   const allocation = emptyAllocation();

   for (const key of ATTRIBUTE_KEYS) {
      const value = raw?.[key];
      if (typeof value === 'number' && Number.isFinite(value))
         allocation[key] = Math.max(0, Math.min(MAX_POINTS_PER_ATTRIBUTE, Math.floor(value)));
   }

   return allocation;
}

/** The hardcoded racial base: ATTRIBUTE_BASE shifted by the race's ±5 modifiers. */
export function baseAttributes(race: RaceId | null): Record<AttributeKey, number> {
   const modifiers: Partial<Record<AttributeKey, number>> = race ? RACES[race].attributeModifiers : {};
   return Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, ATTRIBUTE_BASE + (modifiers[key] ?? 0)]),
   ) as Record<AttributeKey, number>;
}

/** Racial base + creation allocation — what checks and combat actually read. */
export function effectiveAttributes(race: RaceId | null, allocation: AttributeAllocation): Record<AttributeKey, number> {
   const base = baseAttributes(race);
   return Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, base[key] + allocation[key]]),
   ) as Record<AttributeKey, number>;
}

/** Attribute → bonus: the tens digit (Strength 47 → 4). The one shared "how much
 *  does this attribute's raw number actually swing a formula" scale — combat
 *  (Soak, initiative, damage — game/combat/stats.ts re-exports this) and derived
 *  resource maxes (game/character/resources.ts) both read off it. */
export function attributeBonus(value: number): number {
   return Math.floor(value / 10);
}

export function pointsSpent(allocation: AttributeAllocation): number {
   return ATTRIBUTE_KEYS.reduce((sum, key) => sum + allocation[key], 0);
}

export function pointsRemaining(allocation: AttributeAllocation): number {
   return Math.max(0, CREATION_ATTRIBUTE_POINTS - pointsSpent(allocation));
}

/** The creation step is done only when every point has found a home. */
export function isAllocationComplete(allocation: AttributeAllocation): boolean {
   return pointsSpent(allocation) === CREATION_ATTRIBUTE_POINTS;
}

/**
 * Applies a ± button press to one attribute, clamping to what actually fits:
 * per-attribute [0, MAX_POINTS_PER_ATTRIBUTE] and the remaining pool. A +5 with
 * only 3 points left allocates 3 — partial application beats a dead button.
 */
export function adjustAllocation(allocation: AttributeAllocation, key: AttributeKey, delta: number): AttributeAllocation {
   const headroom = Math.min(MAX_POINTS_PER_ATTRIBUTE - allocation[key], pointsRemaining(allocation));
   const applied = delta > 0 ? Math.min(delta, headroom) : Math.max(delta, -allocation[key]);

   return { ...allocation, [key]: allocation[key] + applied };
}
