import type { CharacterDoc } from '../../db/models/character.js';

export interface CombatStats {
   name: string;
   maxHp: number;
   attackBonus: number;
   defenseBonus: number;
   strengthBonus: number;
   enduranceBonus: number;
}

/** Attribute → bonus: the tens digit (Strength 47 → 4), as in RPG/'s derived stats. */
export function attributeBonus(value: number): number {
   return Math.floor(value / 10);
}

/**
 * Derives combat stats from a character's attributes/skills. PLACEHOLDER FORMULA
 * (D14): the real numbers wait on the RPG ruleset (its Wounds/soak math). Since
 * D25 attributes DO differ per race + point-buy, so sparring is no longer fully
 * random — but the shape is still throwaway. The maxHp shape is ported from the
 * old `getMaxHp` (str*5 + wp*5 + endurance*10).
 */
export function combatStatsFromCharacter(character: CharacterDoc): CombatStats {
   const str = attributeBonus(character.attributes.strength);
   const end = attributeBonus(character.attributes.endurance);
   const wp = attributeBonus(character.attributes.willpower);
   const agi = attributeBonus(character.attributes.agility);
   const weaponSkill = character.skills.melee.level + character.skills.unarmed.level;

   return {
      name: character.identity.name,
      maxHp: str * 5 + wp * 5 + end * 10,
      attackBonus: weaponSkill + str,
      defenseBonus: agi + end,
      strengthBonus: str,
      enduranceBonus: end,
   };
}
