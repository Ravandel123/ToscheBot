import { attributeBonus } from '../character/attributes.js';
import { nodePoints } from '../character/skills.js';
import type { CharacterDoc } from '../../db/models/character.js';

// The tens-digit attribute→bonus scale is a character-domain concept (shared by
// derived resource maxes, game/character/resources.ts) — canonical definition
// lives in game/character/attributes.ts; re-exported here since every existing
// combat import pulls it from this file.
export { attributeBonus };

export interface CombatStats {
   name: string;
   maxHp: number;
   attackBonus: number;
   defenseBonus: number;
   strengthBonus: number;
   constitutionBonus: number;
}

/**
 * Derives combat stats from a character's attributes/skills. PLACEHOLDER FORMULA
 * (D14): the real numbers wait on the RPG ruleset (its Wounds/soak math). Since
 * D25 attributes DO differ per race + point-buy, so sparring is no longer fully
 * random — but the shape is still throwaway. The maxHp shape is ported from the
 * old `getMaxHp` (str*5 + wp*5 + constitution*10).
 */
export function combatStatsFromCharacter(character: CharacterDoc): CombatStats {
   const str = attributeBonus(character.attributes.strength);
   const end = attributeBonus(character.attributes.constitution);
   const wp = attributeBonus(character.attributes.willpower);
   const agi = attributeBonus(character.attributes.agility);
   // Placeholder weapon competence: whatever the character has trained in the
   // melee / brawling roots (sparring predates the real combat trees — P-combat).
   // `?? {}` tolerates a pre-D34 doc with no progression (untrained → 0).
   const skills = character.progression?.skills ?? {};
   const weaponSkill = nodePoints(skills, 'melee') + nodePoints(skills, 'brawling');

   return {
      name: character.identity.name,
      maxHp: str * 5 + wp * 5 + end * 10,
      attackBonus: weaponSkill + str,
      defenseBonus: agi + end,
      strengthBonus: str,
      constitutionBonus: end,
   };
}
