import { attributeBonus } from '../character/attributes.js';

// The tens-digit attribute→bonus scale is a character-domain concept (shared by
// derived resource maxes, game/character/resources.ts) — canonical definition
// lives in game/character/attributes.ts; re-exported here since every existing
// combat import pulls it from this file.
export { attributeBonus };

/** Stat block of the for-fun `h!sparring` brawl (random numbers, no character). */
export interface CombatStats {
   name: string;
   maxHp: number;
   attackBonus: number;
   defenseBonus: number;
   strengthBonus: number;
   constitutionBonus: number;
}
