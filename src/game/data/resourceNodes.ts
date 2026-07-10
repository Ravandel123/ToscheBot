import type { ForagableItemId } from './foragables.js';
import type { SkillNodeId } from './skills.js';
import type { RaceId } from './races.js';

// Resource nodes (R16, professions.md): WHAT can be gathered at a place. A
// location's `resourceNodes` (locations.ts) list ids from this catalog — the
// static half of the shared gather loop (spend AP → profession check → item
// instances). One catalog serves every gathering profession: fishing (S2)
// adds `profession: 'fishing'` entries with fish tables, no new mechanism.
// The generic resolver lives in game/professions/gather.ts; ids are stable
// slugs, test-validated against locations like graph edges (D10/D21).
// 🟡 Difficulties, affinities and table weights are balance placeholders.

/** Gathering professions a node can belong to ('fishing' joins in S2). */
export type GatherProfession = 'foraging';

export interface ResourceNodeDefinition {
   /** In-character name of the spot, slotted into narration ('you comb …'). */
   name: string;
   profession: GatherProfession;
   /** The skill node the gather check draws on (and trains, D40). */
   skillNode: SkillNodeId;
   /** Difficulty ladder step on the gather check (+20 easy … −30 punishing). */
   difficulty: number;
   /** Racial chance multipliers — a lutren works a riverbank better (R16). */
   raceAffinity?: Partial<Record<RaceId, number>>;
   /** Weighted yield table; each yielded unit rolls it independently. */
   table: readonly (readonly [ForagableItemId, number])[];
   /** In-character line for a failed gather (nothing worth keeping). */
   emptyLine: string;
}

export const RESOURCE_NODES = {
   riverbank_greens: {
      name: 'the reeds and wet banks',
      profession: 'foraging',
      skillNode: 'foraging',
      difficulty: 20,
      raceAffinity: { lutren: 1.25 },
      table: [
         ['weavers_reed', 5],
         ['stingweed', 3],
         ['marshroot', 1.5],
         ['silverleaf', 0.5],
      ],
      emptyLine: 'You comb the reeds and come up with mud, snails and one very indignant frog.',
   },
   woodland_undergrowth: {
      name: 'the woodland undergrowth',
      profession: 'foraging',
      skillNode: 'foraging',
      difficulty: 20,
      raceAffinity: { tamian: 1.25 },
      table: [
         ['duskberry', 4],
         ['chokepip', 3],
         ['honeycap_mushroom', 3],
         ['ashgill_fungus', 2],
         ['silverleaf', 1],
      ],
      emptyLine: 'You rake through leaf litter and brambles, and the wood keeps its pantry shut.',
   },
} as const satisfies Record<string, ResourceNodeDefinition>;

export type ResourceNodeId = keyof typeof RESOURCE_NODES;

export function isResourceNodeId(id: string): id is ResourceNodeId {
   return id in RESOURCE_NODES;
}

/** A node widened to the interface (hides `as const` narrowing of optionals). */
export function resourceNode(id: ResourceNodeId): ResourceNodeDefinition {
   return RESOURCE_NODES[id];
}
