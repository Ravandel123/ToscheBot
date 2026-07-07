import { checkTarget, type CheckSubject } from '../checks.js';
import { attributeBonus } from './stats.js';
import { fightingStyle, type FightingStyleId, type StyleFamily } from './styles.js';
import { sanitizeFamilyPlan, type FamilyPlan } from './plan.js';
import { attributesWithEquipment, equipmentOf, findItem, totalEquippedArmor } from '../character/inventory.js';
import { displayName } from '../character/identity.js';
import type { BoutLoadout } from './bouts.js';
import type { CombatProfile, DamageType, StyleTargets } from './duel.js';
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
   const attackNode: SkillNodeId = weapon ? weaponSkillNode(weapon) : 'striking';
   const strengthBonus = attributeBonus(attributes.strength);
   const constitutionBonus = attributeBonus(attributes.constitution);

   // Styles are family-specific (D41): what's in your hands decides which
   // catalog (and which stored plan) applies to this bout.
   const family: StyleFamily = weapon ? 'melee' : 'unarmed';
   const plan = sanitizeFamilyPlan(character.combatPlan?.[family], family);

   return {
      characterId: character._id,
      name: displayName(character),
      maxHealth: character.resources.health.max,
      health: character.resources.health.current,
      // Attack draws on the weapon's melee branch (or Striking, the unarmed
      // leaf — its path sums and trains Brawling too); defence is an untrained
      // Agility dodge for now. SEAM: a dedicated Dodge/Parry node +
      // shield-parry bonus (combat.md) is a later blend swap here.
      attackTarget: checkTarget(subject, { node: attackNode, modifier: COMBAT_ATTACK_BASE }),
      attackNode,
      defenseTarget: checkTarget(subject, { attribute: 'agility', attributeWeight: 0.5, modifier: COMBAT_DEFENSE_BASE }),
      damage: weapon ? weapon.damage : { ...UNARMED_DAMAGE },
      damageType: weapon ? weaponDamageType(weapon) : 'impact',
      strengthBonus,
      soak: constitutionBonus + armorValue,
      initiative: attributeBonus(attributes.agility) + attributeBonus(attributes.perception),
      family,
      styleTargets: buildStyleTargets(subject, plan, family, attackNode),
      plan,
   };
}

/**
 * Per-style base d100 targets for every style the plan references, computed
 * UP FRONT (the same honest-odds discipline as challenge options: what a
 * repaint would show and what the engine rolls can never disagree). Each style
 * draws on its skill node (D41): unarmed, the node replaces the attack draw;
 * armed, the weapon branch and the style branch are summed together (extraNodes
 * — the shared melee root dedupes). Defence is the style node's path both ways
 * — the owner's rule: knowing your style well means defending better in it.
 */
function buildStyleTargets(
   subject: CheckSubject,
   plan: FamilyPlan,
   family: StyleFamily,
   attackNode: SkillNodeId,
): Partial<Record<FightingStyleId, StyleTargets>> {
   const referenced = new Set<FightingStyleId>();
   if (plan.style)
      referenced.add(plan.style);
   for (const rule of plan.rules)
      referenced.add(rule.style);

   const targets: Partial<Record<FightingStyleId, StyleTargets>> = {};
   for (const styleId of referenced) {
      const node = fightingStyle(styleId).node;
      targets[styleId] = {
         attack: family === 'melee'
            ? checkTarget(subject, { node: attackNode, extraNodes: [node], modifier: COMBAT_ATTACK_BASE })
            : checkTarget(subject, { node, modifier: COMBAT_ATTACK_BASE }),
         defense: checkTarget(subject, { node, modifier: COMBAT_DEFENSE_BASE }),
      };
   }

   return targets;
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
   return item?.definition.kind === 'weapon' ? item.definition : null;
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
