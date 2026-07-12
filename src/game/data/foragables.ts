import type { CraftingMaterialDefinition, ItemQualityId } from './items/types.js';

// The foraging content catalog (R16, professions.md): what grows wild, what it
// looks like before you know what it is, and how hard it is to tell. The item
// DEFINITIONS here are spread into the main ITEMS catalog (items.ts) so a
// foraged find is an ordinary `material` instance everywhere (pack, stash,
// weight, /item grant); this file adds the profession-only layer on top:
//   * FAMILIES — the coarse category a find always shows, even at zero skill
//     (a mushroom always looks like a mushroom, never "an object" — the
//     professions.md risk note);
//   * DESCRIPTORS — the generic "unknown" names an unidentified instance
//     displays, chosen from the item's `looks`. Two items sharing a look is
//     the point: that overlap is exactly where a failed identify can
//     plausibly MISLABEL one as the other (game/professions/identify.ts);
//   * per-item identify difficulty and the family's quality-name row (R23:
//     one universal tier number, per-family display names — "Pristine", not
//     "Masterwork Mushroom").
// Ids are stable slugs, append-only once a character doc can hold one (D10).
// 🟡 Every number (values, weights, identify modifiers) is a balance placeholder.

// --- Families -------------------------------------------------------------------

export interface ForageFamilyDefinition {
   name: string;
   /** The coarse noun an unidentified find is still known to be ('mushroom'). */
   singular: string;
}

export const FORAGE_FAMILIES = {
   mushroom: { name: 'Mushrooms', singular: 'mushroom' },
   herb: { name: 'Herbs', singular: 'herb' },
   berry: { name: 'Berries', singular: 'berry' },
   waterplant: { name: 'Water plants', singular: 'water plant' },
} as const satisfies Record<string, ForageFamilyDefinition>;

export type ForageFamilyId = keyof typeof FORAGE_FAMILIES;

// --- Descriptors (the "unknown" name pool, per family) ----------------------------

export interface ForageDescriptorDefinition {
   family: ForageFamilyId;
   /** Lowercase noun phrase with its article: 'an amber-capped mushroom'. */
   text: string;
}

export const FORAGE_DESCRIPTORS = {
   // Mushrooms
   amber_capped: { family: 'mushroom', text: 'an amber-capped mushroom' },
   grey_gilled: { family: 'mushroom', text: 'a grey-gilled toadstool' },
   squat_bulbous: { family: 'mushroom', text: 'a squat, bulbous fungus' },
   // Herbs
   silvery_leaved: { family: 'herb', text: 'a sprig of silvery leaves' },
   ragged_nettle: { family: 'herb', text: 'a ragged, nettle-like plant' },
   waxy_stemmed: { family: 'herb', text: 'a waxy-stemmed herb' },
   // Berries
   dark_clustered: { family: 'berry', text: 'a cluster of dark berries' },
   pale_waxy: { family: 'berry', text: 'a pale, waxy berry' },
   blushing: { family: 'berry', text: 'a blushing red berry' },
   // Water plants
   tall_hollow_reed: { family: 'waterplant', text: 'a tall, hollow reed' },
   braided_rush: { family: 'waterplant', text: 'a braided rush stalk' },
   knotted_root: { family: 'waterplant', text: 'a knotted, sharp-smelling root' },
} as const satisfies Record<string, ForageDescriptorDefinition>;

export type ForageDescriptorId = keyof typeof FORAGE_DESCRIPTORS;

/** Resolves a stored descriptor id, tolerating stale ones (D10 rule 3). */
export function forageDescriptor(id: string): ForageDescriptorDefinition | null {
   return id in FORAGE_DESCRIPTORS ? FORAGE_DESCRIPTORS[id as ForageDescriptorId] : null;
}

// --- The foraged items (spread into ITEMS by items.ts) ----------------------------

export const FORAGABLE_ITEMS = {
   honeycap_mushroom: {
      kind: 'material',
      name: 'Honeycap Mushroom',
      description: 'Amber-capped and honey-sweet. Tavern cooks pay well for a basketful.',
      weightKg: 0.1,
      value: 6,
   },
   ashgill_fungus: {
      kind: 'material',
      name: 'Ashgill Fungus',
      description: 'Grey-gilled and bitter. A purgative in careful hands; a memorable evening otherwise.',
      weightKg: 0.1,
      value: 2,
   },
   silverleaf: {
      kind: 'material',
      name: 'Silverleaf',
      description: 'Pale leaves that cool a wound. The infirmary never has enough.',
      weightKg: 0.1,
      value: 12,
   },
   stingweed: {
      kind: 'material',
      name: 'Stingweed',
      description: 'A ragged nettle that bites first. Boiled down, it loosens stiff joints.',
      weightKg: 0.1,
      value: 3,
   },
   duskberry: {
      kind: 'material',
      name: 'Duskberry',
      description: 'Dark, sweet clusters that ripen at dusk. Half of them never make it home.',
      weightKg: 0.2,
      value: 4,
   },
   chokepip: {
      kind: 'material',
      name: 'Chokepip',
      description: 'A pale berry, all pit and pucker. Birds will not touch it — a lesson there.',
      weightKg: 0.2,
      value: 1,
   },
   weavers_reed: {
      kind: 'material',
      name: 'Weaver\'s Reed',
      description: 'Tall river reed, hollow and true. Baskets, thatch and arrow shafts start here.',
      weightKg: 0.3,
      value: 3,
   },
   marshroot: {
      kind: 'material',
      name: 'Marshroot',
      description: 'A knotted root the river hides under its banks. Herbalists want it whole and pay for the digging.',
      weightKg: 0.3,
      value: 8,
   },
} as const satisfies Record<string, CraftingMaterialDefinition>;

export type ForagableItemId = keyof typeof FORAGABLE_ITEMS;

// --- The profession layer per item -------------------------------------------------

export interface ForagableInfo {
   family: ForageFamilyId;
   /** Descriptor ids that fit this item's look — the ambiguity a mislabel hides in.
    *  Every entry must belong to the same family (test-validated). */
   looks: readonly [ForageDescriptorId, ...ForageDescriptorId[]];
   /** Difficulty ladder step on the identify check: + = common knowledge,
    *  − = genuinely tricky (an ashgill passes for a honeycap when young). 🟡 */
   identifyModifier: number;
   /** Rare enough that an identified find makes the chronicle (D24). */
   noteworthy?: boolean;
}

export const FORAGABLES = {
   honeycap_mushroom: { family: 'mushroom', looks: ['amber_capped', 'squat_bulbous'], identifyModifier: 10 },
   ashgill_fungus: { family: 'mushroom', looks: ['grey_gilled', 'amber_capped'], identifyModifier: -10 },
   silverleaf: { family: 'herb', looks: ['silvery_leaved', 'waxy_stemmed'], identifyModifier: 0, noteworthy: true },
   stingweed: { family: 'herb', looks: ['ragged_nettle', 'silvery_leaved'], identifyModifier: 20 },
   duskberry: { family: 'berry', looks: ['dark_clustered', 'blushing'], identifyModifier: 10 },
   chokepip: { family: 'berry', looks: ['pale_waxy', 'dark_clustered'], identifyModifier: 0 },
   weavers_reed: { family: 'waterplant', looks: ['tall_hollow_reed', 'braided_rush'], identifyModifier: 20 },
   marshroot: { family: 'waterplant', looks: ['knotted_root', 'braided_rush'], identifyModifier: -10, noteworthy: true },
} as const satisfies Record<ForagableItemId, ForagableInfo>;

export const FORAGABLE_ITEM_IDS = Object.keys(FORAGABLES) as ForagableItemId[];

export function isForagableId(id: string): id is ForagableItemId {
   return id in FORAGABLES;
}

/** The profession layer of a stored item id, if it is a foragable (D10 rule 3). */
export function foragableInfo(id: string): ForagableInfo | null {
   return isForagableId(id) ? FORAGABLES[id] : null;
}

// --- Quality display (the R23 seam: per-family name rows on the shared tiers) ------

/** The forage family's name row over today's 4 quality tiers — 'Masterwork
 *  Mushroom' is nonsense, 'Pristine' is not (R23). Consulted by the display
 *  layer for foragable items; gear keeps ITEM_QUALITIES' own prefixes. 🟡 */
export const FORAGE_QUALITY_PREFIXES: Record<ItemQualityId, string> = {
   poor: 'Wilted',
   common: '',
   fine: 'Choice',
   masterwork: 'Pristine',
};
