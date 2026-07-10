import { FORAGABLE_ITEMS } from './foragables.js';
import type { AttributeKey } from './attributes.js';
import type { ResourceKey } from './resources.js';
import type { EquipmentSlotId } from './equipmentSlots.js';

// The item catalog (D28) — static content in code (D10): the DB stores only
// item INSTANCES ({ instanceId, itemId, quality, quantity, durability })
// referencing these definitions by stable slug. WHFRP-flavored on purpose
// (RPG/Ruleset.md §8): weapons carry reach + properties (Piercing, Entangling…),
// armor trades protection for attribute penalties, craftsmanship quality is a
// per-instance tier. 🟡 Every NUMBER here (damage, weights, values, penalties,
// requirements) is a balance placeholder pending the Phase 7 ruleset (D14) —
// the SHAPES are the stable part. Ids are append-only (D10): never rename or
// delete one that may live in a character doc.

// --- Item kinds ---------------------------------------------------------------

export interface ItemKindDefinition {
   name: string;
   emoji: string;
   /** Stackable kinds merge by (itemId, quality) into one instance with a quantity. */
   stackable: boolean;
}

// Adding a NEW KIND of item = one entry here + one member in the definition
// union below (+ a stat-block case in the inventory panel). The browser's
// category tabs render from this map, in this order.
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
// smiths (RPG/Ruleset.md §4/§8), so bronze gear is a tier above iron in value.
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
   /** One tooltip line — a casual must grok it at a glance (RPG/ §6 bar). */
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
   /** 🟡 Armor value (AV) it adds; Soak math comes with Phase 7 (RPG/ §3). */
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

// --- The catalog --------------------------------------------------------------------

export const ITEMS = {
   // Weapons ----------------------------------------------------------------
   iron_dagger: {
      kind: 'weapon',
      name: 'Iron Dagger',
      description: 'A soldier\'s last argument — quick, mean, and easy to hide.',
      material: 'iron',
      weightKg: 0.4,
      value: 15,
      slots: ['mainHand', 'offHand'],
      hands: 1,
      damage: { min: 2, max: 5 },
      reach: 'veryShort',
      durabilityMax: 40,
      properties: ['fast', 'piercing'],
   },
   iron_sword: {
      kind: 'weapon',
      name: 'Iron Sword',
      description: 'Standard issue for half the garrisons of Dunia. Unremarkable and reliable.',
      material: 'iron',
      weightKg: 1.3,
      value: 60,
      slots: ['mainHand'],
      hands: 1,
      damage: { min: 4, max: 9 },
      reach: 'average',
      durabilityMax: 60,
   },
   steel_longsword: {
      kind: 'weapon',
      name: 'Steel Longsword',
      description: 'Kishar steel, patient work. Holds an edge the way iron never will.',
      material: 'steel',
      weightKg: 1.6,
      value: 180,
      slots: ['mainHand'],
      hands: 1,
      damage: { min: 5, max: 11 },
      reach: 'average',
      durabilityMax: 90,
      properties: ['precise'],
      attributeRequirements: { strength: 30 },
   },
   woodsmans_axe: {
      kind: 'weapon',
      name: 'Woodsman\'s Axe',
      description: 'Meant for oak, but a shield is only oak with opinions.',
      material: 'iron',
      weightKg: 1.5,
      value: 40,
      slots: ['mainHand'],
      hands: 1,
      damage: { min: 4, max: 9 },
      reach: 'short',
      durabilityMax: 55,
      properties: ['hack'],
   },
   war_maul: {
      kind: 'weapon',
      name: 'War Maul',
      description: 'Two-handed persuasion. What it cannot cut, it flattens.',
      material: 'iron',
      weightKg: 5.5,
      value: 150,
      slots: ['mainHand'],
      hands: 2,
      damage: { min: 8, max: 16 },
      reach: 'average',
      durabilityMax: 80,
      properties: ['impact', 'pummel', 'slow'],
      attributeRequirements: { strength: 40 },
   },
   ash_spear: {
      kind: 'weapon',
      name: 'Ash Spear',
      description: 'A shaft of ash and a finger of iron. Keeps trouble at arm\'s length — and further.',
      material: 'wood',
      weightKg: 2.0,
      value: 35,
      slots: ['mainHand'],
      hands: 1,
      damage: { min: 4, max: 8 },
      reach: 'long',
      durabilityMax: 45,
      properties: ['piercing'],
   },
   quarterstaff: {
      kind: 'weapon',
      name: 'Quarterstaff',
      description: 'Every road-wise traveler carries one. The rain of blows parts around it.',
      material: 'wood',
      weightKg: 1.8,
      value: 10,
      slots: ['mainHand'],
      hands: 2,
      damage: { min: 3, max: 7 },
      reach: 'long',
      durabilityMax: 50,
      properties: ['defensive', 'pummel'],
   },
   weighted_net: {
      kind: 'weapon',
      name: 'Weighted Net',
      description: 'Lutren fishing gear, repurposed. Catches more than carp.',
      material: 'cloth',
      weightKg: 3.0,
      value: 25,
      slots: ['mainHand', 'offHand'],
      hands: 1,
      damage: { min: 0, max: 1 },
      reach: 'short',
      durabilityMax: 30,
      properties: ['entangling'],
   },
   bronze_boarding_axe: {
      kind: 'weapon',
      name: 'Bronze Boarding Axe',
      description: 'Polcan work from across the Western Sea — nobody else forges bronze, and they never sell cheap.',
      material: 'bronze',
      weightKg: 1.4,
      value: 320,
      slots: ['mainHand'],
      hands: 1,
      damage: { min: 5, max: 9 },
      reach: 'short',
      durabilityMax: 70,
      properties: ['hack', 'fast'],
   },

   // Shields ----------------------------------------------------------------
   wooden_buckler: {
      kind: 'shield',
      name: 'Wooden Buckler',
      description: 'A fist-sized answer to sharp questions.',
      material: 'wood',
      weightKg: 1.5,
      value: 20,
      slots: ['offHand'],
      armor: 1,
      durabilityMax: 40,
   },
   iron_kite_shield: {
      kind: 'shield',
      name: 'Iron Kite Shield',
      description: 'Covers you from chin to shin, provided you can lug it.',
      material: 'iron',
      weightKg: 4.5,
      value: 130,
      slots: ['offHand'],
      armor: 2,
      durabilityMax: 80,
      attributeRequirements: { strength: 30 },
      attributeModifiers: { agility: -5 },
   },

   // Armor ------------------------------------------------------------------
   leather_jerkin: {
      kind: 'armor',
      name: 'Leather Jerkin',
      description: 'Boiled leather, scarred and supple. The unsung armor of everyone with work to do.',
      material: 'leather',
      weightKg: 3.0,
      value: 45,
      slots: ['chest'],
      armor: 1,
      durabilityMax: 50,
   },
   mail_shirt: {
      kind: 'armor',
      name: 'Mail Shirt',
      description: 'Ten thousand rings singing quietly. Heavy — but so is a blade between the ribs.',
      material: 'iron',
      weightKg: 9.0,
      value: 220,
      slots: ['chest'],
      armor: 2,
      durabilityMax: 80,
      attributeRequirements: { strength: 25 },
      attributeModifiers: { agility: -5 },
   },
   steel_breastplate: {
      kind: 'armor',
      name: 'Steel Breastplate',
      description: 'Deltrada parade steel. Turns blades, turns heads, makes cartwheels impossible.',
      material: 'steel',
      weightKg: 7.0,
      value: 450,
      slots: ['chest'],
      armor: 3,
      durabilityMax: 100,
      attributeRequirements: { strength: 35 },
      attributeModifiers: { agility: -10, dexterity: -5 },
   },
   leather_cap: {
      kind: 'armor',
      name: 'Leather Cap',
      description: 'Will not stop a maul, but keeps branches and bad weather honest.',
      material: 'leather',
      weightKg: 0.5,
      value: 15,
      slots: ['head'],
      armor: 1,
      durabilityMax: 40,
   },
   steel_helm: {
      kind: 'armor',
      name: 'Steel Helm',
      description: 'Keeps your skull whole and your hearing halved.',
      material: 'steel',
      weightKg: 2.2,
      value: 160,
      slots: ['head'],
      armor: 2,
      durabilityMax: 90,
      attributeModifiers: { perception: -5 },
   },
   mail_leggings: {
      kind: 'armor',
      name: 'Mail Leggings',
      description: 'Chafe like penance and rattle like a purse. Worth every step.',
      material: 'iron',
      weightKg: 6.0,
      value: 180,
      slots: ['legs'],
      armor: 2,
      durabilityMax: 70,
      attributeRequirements: { strength: 25 },
      attributeModifiers: { agility: -5 },
   },
   sturdy_boots: {
      kind: 'armor',
      name: 'Sturdy Boots',
      description: 'Have carried three owners and outlived two.',
      material: 'leather',
      weightKg: 1.4,
      value: 25,
      slots: ['feet'],
      armor: 1,
      durabilityMax: 60,
   },
   leather_gloves: {
      kind: 'armor',
      name: 'Leather Gloves',
      description: 'Calluses you can take off at night.',
      material: 'leather',
      weightKg: 0.3,
      value: 12,
      slots: ['hands'],
      armor: 1,
      durabilityMax: 40,
   },

   // Consumables --------------------------------------------------------------
   travel_rations: {
      kind: 'consumable',
      name: 'Travel Rations',
      description: 'Hardtack, dried carp, a knot of honeyed oats. Not good — enough.',
      weightKg: 0.5,
      value: 8,
      effects: { stamina: 5 },
   },
   dried_carp: {
      kind: 'consumable',
      name: 'Dried Carp',
      description: 'The riverbank\'s honest coin. Chewy.',
      weightKg: 0.3,
      value: 4,
      effects: { stamina: 3 },
   },
   healers_poultice: {
      kind: 'consumable',
      name: 'Healer\'s Poultice',
      description: 'Herbs and clean linen from the infirmary. Stings enough to know it works.',
      material: 'cloth',
      weightKg: 0.2,
      value: 30,
      effects: { health: 5 },
   },
   honeyed_mead: {
      kind: 'consumable',
      name: 'Honeyed Mead',
      description: 'The Sunken Tankard\'s cheapest cask. Courage by the mug.',
      weightKg: 1.0,
      value: 12,
      effects: { stamina: 2, health: 1 },
   },

   // Crafting materials ---------------------------------------------------------
   // Foraged materials live in their own catalog (foragables.ts — descriptor
   // pools, families, identify difficulties) and are spread in here so they are
   // ordinary items everywhere else.
   ...FORAGABLE_ITEMS,
   iron_ingot: {
      kind: 'material',
      name: 'Iron Ingot',
      description: 'Waiting to become something sharper.',
      material: 'iron',
      weightKg: 2.0,
      value: 20,
   },
   oak_timber: {
      kind: 'material',
      name: 'Oak Timber',
      description: 'Seasoned heartwood. Shields, hafts, honest furniture.',
      material: 'wood',
      weightKg: 4.0,
      value: 10,
   },
   linen_bolt: {
      kind: 'material',
      name: 'Bolt of Linen',
      description: 'Bandages, banners, or a better shirt — weaver\'s choice.',
      material: 'cloth',
      weightKg: 1.0,
      value: 15,
   },
   carp_scales: {
      kind: 'material',
      name: 'Carp Scales',
      description: 'They catch the light. Some tamian pay for the shimmer.',
      material: 'bone',
      weightKg: 0.1,
      value: 2,
   },

   // Clutter ---------------------------------------------------------------------
   bent_spoon: {
      kind: 'clutter',
      name: 'Bent Spoon',
      description: 'Slightly bent. It has seen things, yes-yes.',
      material: 'iron',
      weightKg: 0.1,
      value: 1,
   },
   cracked_tankard: {
      kind: 'clutter',
      name: 'Cracked Tankard',
      description: 'Retired from the Sunken Tankard after long and honorable service.',
      material: 'wood',
      weightKg: 0.4,
      value: 2,
   },
   smooth_river_stone: {
      kind: 'clutter',
      name: 'Smooth River Stone',
      description: 'Perfectly ordinary. You picked it up anyway.',
      material: 'stone',
      weightKg: 0.2,
      value: 1,
   },
   mysterious_sock: {
      kind: 'clutter',
      name: 'Mysterious Sock',
      description: 'Just the one. Its partner is a story nobody knows.',
      material: 'cloth',
      weightKg: 0.1,
      value: 1,
   },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function isItemId(id: string): id is ItemId {
   return id in ITEMS;
}

/** Resolves a stored item id, tolerating unknown ones (D10 rule 3: a rename
 *  that skipped migration must degrade gracefully, not crash the panel). */
export function itemDefinition(id: string): ItemDefinition | null {
   return isItemId(id) ? ITEMS[id] : null;
}
