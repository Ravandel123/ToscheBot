import type { AttributeKey } from '../attributes.js';
import type { EquipmentSlotId } from '../equipmentSlots.js';
import type { ResourceKey } from '../resources.js';

// The item TYPE SYSTEM (D28/D50): kinds, craftsmanship qualities, materials,
// weapon properties/reach and the definition union. The catalog ENTRIES live
// in the sibling per-kind files (weapons.ts, armor.ts…) and are assembled into
// ITEMS by ../items.ts — import from there, not from here, unless you are a
// catalog file yourself. WHFRP-flavored on purpose (Ruleset/items-equipment.md).
// 🟡 Every NUMBER in the catalogs (damage, weights, values, penalties,
// requirements) is a balance placeholder pending the Phase 7 ruleset (D14) —
// the SHAPES here are the stable part.

// --- Item kinds ---------------------------------------------------------------

export interface ItemKindDefinition {
   name: string;
   emoji: string;
   /** Stackable kinds merge by (itemId, quality) into one instance with a quantity. */
   stackable: boolean;
}

// Adding a NEW KIND of item = one entry here + one member in the definition
// union below + its own catalog file spread into ITEMS (+ a stat-block case in
// the inventory panel). The browser's category tabs render from this map, in
// this order.
export const ITEM_KINDS = {
   weapon: { name: 'Weapons', emoji: '⚔️', stackable: false },
   shield: { name: 'Shields', emoji: '🛡️', stackable: false },
   armor: { name: 'Armor', emoji: '🎽', stackable: false },
   consumable: { name: 'Consumables', emoji: '🍖', stackable: true },
   material: { name: 'Materials', emoji: '🪵', stackable: true },
   clutter: { name: 'Clutter', emoji: '📦', stackable: true },
} as const satisfies Record<string, ItemKindDefinition>;

export type ItemKindId = keyof typeof ITEM_KINDS;

export const ITEM_KIND_IDS = Object.keys(ITEM_KINDS) as ItemKindId[];

// --- Craftsmanship quality (per INSTANCE, not per catalog entry) ---------------

export interface ItemQualityDefinition {
   name: string;
   /** Prepended to the item name ('' = none): 'Battered Iron Sword'. */
   prefix: string;
   /** 🟡 Scales the catalog durabilityMax for the instance. */
   durabilityMultiplier: number;
   /** 🟡 Scales the catalog value (display-only until the economy lands). */
   valueMultiplier: number;
}

// WHFRP's poor/common/good/best ladder. One catalog entry drops at any tier,
// so loot variety costs nothing. 🟡 Multipliers are placeholders; quality does
// NOT touch damage/armor yet — that interaction belongs to the Phase 7 ruleset.
export const ITEM_QUALITIES = {
   poor: { name: 'Poor', prefix: 'Battered', durabilityMultiplier: 0.5, valueMultiplier: 0.4 },
   common: { name: 'Common', prefix: '', durabilityMultiplier: 1, valueMultiplier: 1 },
   fine: { name: 'Fine', prefix: 'Fine', durabilityMultiplier: 1.5, valueMultiplier: 2.5 },
   masterwork: { name: 'Masterwork', prefix: 'Masterwork', durabilityMultiplier: 2, valueMultiplier: 6 },
} as const satisfies Record<string, ItemQualityDefinition>;

export type ItemQualityId = keyof typeof ITEM_QUALITIES;

export const DEFAULT_ITEM_QUALITY: ItemQualityId = 'common';

export function isItemQualityId(id: string): id is ItemQualityId {
   return id in ITEM_QUALITIES;
}

// --- Materials ------------------------------------------------------------------

export interface MaterialDefinition {
   name: string;
}

// What a thing is made of — display + future crafting/economy hook. Bronze is
// deliberately present and pricey: canon makes the polcan the only bronze
// smiths (Ruleset/items-equipment.md), so bronze gear is a tier above iron in value.
export const MATERIALS = {
   wood: { name: 'Wood' },
   iron: { name: 'Iron' },
   steel: { name: 'Steel' },
   bronze: { name: 'Bronze' },
   leather: { name: 'Leather' },
   cloth: { name: 'Cloth' },
   bone: { name: 'Bone' },
   stone: { name: 'Stone' },
} as const satisfies Record<string, MaterialDefinition>;

export type MaterialId = keyof typeof MATERIALS;

// --- Weapon properties (WHFRP "weapon qualities") --------------------------------

export interface WeaponPropertyDefinition {
   name: string;
   /** One tooltip line — a casual must grok it at a glance (Ruleset/ §6 bar). */
   description: string;
}

// Descriptors for now: combat consumes them in Phase 7 (D14); until then they
// are honest flavor the owner can author against. Append-only ids (D10).
export const WEAPON_PROPERTIES = {
   piercing: { name: 'Piercing', description: 'Punches through armor.' },
   entangling: { name: 'Entangling', description: 'Snags limbs and weapons — can grapple a foe.' },
   fast: { name: 'Fast', description: 'Strikes before slower weapons.' },
   slow: { name: 'Slow', description: 'Heavy, telegraphed swings.' },
   impact: { name: 'Impact', description: 'Hits with brutal, bone-jarring force.' },
   defensive: { name: 'Defensive', description: 'Made to parry with.' },
   hack: { name: 'Hack', description: 'Bites through shields and wooden defenses.' },
   pummel: { name: 'Pummel', description: 'A solid blow can stun.' },
   precise: { name: 'Precise', description: 'Rewards a careful, practiced hand.' },
} as const satisfies Record<string, WeaponPropertyDefinition>;

export type WeaponPropertyId = keyof typeof WEAPON_PROPERTIES;

// --- Weapon reach -----------------------------------------------------------------

export interface WeaponReachDefinition {
   name: string;
   /** Ordering knob for future reach mechanics (longer strikes first, etc.). */
   order: number;
}

export const WEAPON_REACH = {
   veryShort: { name: 'Very short', order: 0 },
   short: { name: 'Short', order: 1 },
   average: { name: 'Average', order: 2 },
   long: { name: 'Long', order: 3 },
   veryLong: { name: 'Very long', order: 4 },
} as const satisfies Record<string, WeaponReachDefinition>;

export type WeaponReachId = keyof typeof WEAPON_REACH;

// --- Definitions -------------------------------------------------------------------

interface ItemDefinitionBase {
   name: string;
   /** Short in-character line shown on the item card. */
   description: string;
   /** What it's (mostly) made of; omit where it makes no sense (rations). */
   material?: MaterialId;
   weightKg: number;
   /** 🪙 Base value in deltradaCoins — display-only until the economy (D19/P17). */
   value: number;
}

// Shared by everything a character can wear/wield. `attributeModifiers` uses
// the same shape/name as races.ts: while equipped they shift the effective
// attributes (plate mail −10 agility) — consumed by d100 checks and the sheet.
interface EquippableBase extends ItemDefinitionBase {
   /** Slots this item may occupy — one of them is chosen at equip time. */
   slots: readonly EquipmentSlotId[];
   durabilityMax: number;
   /** Minimum attribute values to equip ('too heavy for your arms'). */
   attributeRequirements?: Partial<Record<AttributeKey, number>>;
   /** Applied to effective attributes WHILE equipped (usually penalties). */
   attributeModifiers?: Partial<Record<AttributeKey, number>>;
}

export interface WeaponDefinition extends EquippableBase {
   kind: 'weapon';
   /** 🟡 Placeholder damage range until the Phase 7 combat math (D14). */
   damage: { min: number; max: number };
   reach: WeaponReachId;
   /** Two-handed weapons occupy the main hand and demand the off hand be free. */
   hands: 1 | 2;
   properties?: readonly WeaponPropertyId[];
}

export interface ShieldDefinition extends EquippableBase {
   kind: 'shield';
   /** 🟡 Armor value (AV) it adds; Soak math comes with Phase 7 (Ruleset/combat.md). */
   armor: number;
}

export interface ArmorDefinition extends EquippableBase {
   kind: 'armor';
   /** 🟡 Armor value (AV) for the body part it covers. */
   armor: number;
}

export interface ConsumableDefinition extends ItemDefinitionBase {
   kind: 'consumable';
   /** Resource deltas applied on use (one charge of the stack). */
   effects: Partial<Record<ResourceKey, number>>;
}

export interface CraftingMaterialDefinition extends ItemDefinitionBase {
   kind: 'material';
}

export interface ClutterDefinition extends ItemDefinitionBase {
   kind: 'clutter';
}

export type ItemDefinition =
   | WeaponDefinition
   | ShieldDefinition
   | ArmorDefinition
   | ConsumableDefinition
   | CraftingMaterialDefinition
   | ClutterDefinition;

export type EquippableDefinition = WeaponDefinition | ShieldDefinition | ArmorDefinition;

/** Kinds that can be worn/wielded (they alone carry slots + durability). */
export function isEquippable(definition: ItemDefinition): definition is EquippableDefinition {
   return definition.kind === 'weapon' || definition.kind === 'shield' || definition.kind === 'armor';
}
