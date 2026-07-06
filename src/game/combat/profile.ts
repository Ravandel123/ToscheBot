import { checkTarget } from '../checks.js';
import { attributeBonus } from './stats.js';
import { attributesWithEquipment, equipmentOf, findItem, totalEquippedArmor } from '../character/inventory.js';
import { displayName } from '../character/identity.js';
import type { BoutLoadout } from './bouts.js';
import type { CombatProfile, DamageType } from './duel.js';
import type { AttributeKey } from '../data/attributes.js';
import type { SkillNodeId } from '../data/skills.js';
import type { WeaponDefinition } from '../data/items.js';
import type { CharacterDoc } from '../../db/models/character.js';

// Derives an engine-ready CombatProfile (duel.ts) from a real character — the
// one place attributes, the skill tree (game/checks.ts + skills.ts) and equipped
// gear (D28) feed serious combat. The engine itself never sees a CharacterDoc.
//
// 🟡 Every tuning constant here is a balance placeholder (D14 stance: SHAPE is
// stable, NUMBERS wait on the Phase 7 ruleset). They exist so the derived d100
// targets land in a readable, decisive band on today's attribute values.

/** Bare fists/claws when nothing is wielded — the Spire staple. 🟡 */
const UNARMED_DAMAGE = { min: 1, max: 3 } as const;

// The skill-tree Effective of an untrained fighter is only ~half an attribute
// (combat blends are ~0.5), so a flat base lifts attack/defence into a band where
// a bout is decisive without being a coin-flip. Attack sits a touch above defence
// so blows land and fights don't grind. 🟡
const COMBAT_ATTACK_BASE = 25;
const COMBAT_DEFENSE_BASE = 15;

export interface CombatProfileOptions {
   /** How gear is handled (game/combat/bouts.ts). Default: fight as equipped. */
   loadout?: BoutLoadout;
}

/**
 * Builds a combatant from the character under the chosen bout loadout. With
 * `as-equipped` (default): equipment-modified attributes (a plate-clad brawler is
 * slower), the wielded weapon's damage, and worn Armour Value in Soak (D28). With
 * `unarmed-unarmored`: gear is set aside — bare attributes, fists, no AV — as if
 * the fighter stripped down at the door (the pack itself is untouched). Health is
 * always the character's real pool. Read the character fresh under the lock first.
 */
export function combatProfile(character: CharacterDoc, options: CombatProfileOptions = {}): CombatProfile {
   const stripped = options.loadout === 'unarmed-unarmored';

   // Stripped fighters use their BARE attributes (no equip modifiers) and wield
   // nothing; otherwise equipment shapes the whole profile.
   const attributes = stripped ? bareAttributes(character) : attributesWithEquipment(character);
   // checkTarget wants the same subject shape the challenge activity passes —
   // the character with its attributes swapped for the set in play this bout.
   const subject = { ...character, attributes };

   const weapon = stripped ? null : equippedWeapon(character);
   const armorValue = stripped ? 0 : totalEquippedArmor(character);
   const attackNode: SkillNodeId = weapon ? weaponSkillNode(weapon) : 'brawling';
   const strengthBonus = attributeBonus(attributes.strength);
   const constitutionBonus = attributeBonus(attributes.consitution);

   return {
      characterId: character._id,
      name: displayName(character),
      maxHealth: character.resources.health.max,
      health: character.resources.health.current,
      // Attack draws on the weapon's melee branch (or Brawling); defence is an
      // untrained Agility dodge for now. SEAM: a dedicated Dodge/Parry node +
      // shield-parry bonus (combat.md) is a later blend swap here.
      attackTarget: checkTarget(subject, { node: attackNode, modifier: COMBAT_ATTACK_BASE }),
      defenseTarget: checkTarget(subject, { attribute: 'agility', attributeWeight: 0.5, modifier: COMBAT_DEFENSE_BASE }),
      damage: weapon ? weapon.damage : { ...UNARMED_DAMAGE },
      damageType: weapon ? weaponDamageType(weapon) : 'impact',
      strengthBonus,
      soak: constitutionBonus + armorValue,
      initiative: attributeBonus(attributes.agility) + attributeBonus(attributes.perception),
      stance: 'balanced',
   };
}

/** A character's attributes WITHOUT any equipment modifiers — what a bare-knuckle
 *  bout rolls against (armour penalties don't apply to gear you took off). */
function bareAttributes(character: CharacterDoc): Record<AttributeKey, number> {
   return character.attributes;
}

/** True when a character is Downed (0 Health) — unconscious, cannot fight or act
 *  (canCharacterAct reports the same as 'incapacitated'). Derived, no stored
 *  flag: healing above 0 clears it. SEAM for a richer recovery/infirmary state. */
export function isDowned(character: Pick<CharacterDoc, 'resources'>): boolean {
   return character.resources.health.current <= 0;
}

/** The weapon in the main hand, or null when unarmed (an off-hand-only item or a
 *  shield does not arm the attack). */
export function equippedWeapon(character: CharacterDoc): WeaponDefinition | null {
   const mainHandId = equipmentOf(character).mainHand;
   if (!mainHandId)
      return null;

   const item = findItem(character, mainHandId);
   return item && item.definition.kind === 'weapon' ? item.definition : null;
}

/** Which melee branch a weapon trains/attacks with — grip-based for v1 (both live
 *  under the `melee` root, so it also rewards training the root). SEAM: map to the
 *  specific blade/axe/polearm leaf once weapons carry a skill tag. */
function weaponSkillNode(weapon: WeaponDefinition): SkillNodeId {
   return weapon.hands === 2 ? 'two_handed' : 'one_handed';
}

/** Coarse damage family from a weapon's properties — display/seam only (the
 *  armour × type multiplier is a deferred layer, combat.md). */
function weaponDamageType(weapon: WeaponDefinition): DamageType {
   const properties = weapon.properties ?? [];
   if (properties.includes('impact') || properties.includes('pummel'))
      return 'impact';
   if (properties.includes('piercing'))
      return 'pierce';

   return 'slash';
}
