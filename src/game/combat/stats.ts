import type { CharacterDoc } from '../../db/models/character.js';

export interface CombatStats {
   name: string;
   maxHp: number;
   attackBonus: number;
   defenseBonus: number;
   strengthBonus: number;
   toughnessBonus: number;
}

/** Attribute → bonus, as in the old bot: every 10 points = +1. */
export function attributeBonus(value: number): number {
   return Math.floor(value / 10);
}

/**
 * Derives combat stats from a character's attributes/skills. PLACEHOLDER FORMULA
 * (D14): the real numbers wait on the RPG ruleset. At base stats everyone is
 * identical, so sparring is effectively random — that's expected for now. The
 * maxHp shape is ported from the old `getMaxHp` (str*5 + wp*5 + tou*10 → 20).
 */
export function combatStatsFromCharacter(character: CharacterDoc): CombatStats {
   const str = attributeBonus(character.attributes.strength);
   const tou = attributeBonus(character.attributes.toughness);
   const wp = attributeBonus(character.attributes.willpower);
   const agi = attributeBonus(character.attributes.agility);
   const weaponSkill = character.skills.melee.level + character.skills.unarmed.level;

   return {
      name: character.identity.name,
      maxHp: str * 5 + wp * 5 + tou * 10,
      attackBonus: weaponSkill + str,
      defenseBonus: agi + tou,
      strengthBonus: str,
      toughnessBonus: tou,
   };
}
