import type { AttributeKey } from './attributes.js';

// Skill TREES (RPG/'s P-skilltree, owner-designed 2026-07-05). A skill is not a
// flat level — it is a NODE in a tree: a general parent (Smithing) branches into
// Weaponsmithing / Armoursmithing, which branch into Bladesmithing / Axesmithing…
// Depth is arbitrary (a tree may be 2 deep or 7 deep); the shape lives entirely
// here as static content (D10). A character stores only a SPARSE flat map of the
// nodes they have points in (game/character/skills.ts) — the parent/child links
// are NEVER duplicated per character, so adding a branch or a whole new tree is
// one catalog edit with zero migration.
//
// How a node feeds a check (the summed model, RPG/ R10):
//   Effective = Σ(weight · attribute)               ← the node's `attributes` blend
//             + Σ(points on every node root→leaf)    ← the character's trained nodes
// so forging a sword sums Smithing + Weaponsmithing + Bladesmithing (parents give
// a baseline, the leaf makes the master) plus a weighted attribute term. The
// blend is per-node and freely tunable — Intimidate can read 50% STR + 50% CHA
// while its Persuade sibling reads pure CHA (see the speechcraft tree).
//
// 🟡 Every number here (attribute weights, growth rates, the tree content) is a
// balance placeholder; the SHAPE (trees, per-node blends, per-node growth) is the
// stable part consumers build on.

// --- Growth (learn-by-doing, RPG/ §7) --------------------------------------
// Each node trains at its own rate: a leaf rises fast, a root crawls, and every
// rank costs more uses than the last (diminishing returns). A "meaningful use"
// (a real, contested action — the caller decides) credits +1 use to EVERY node
// on the path, and each node converts uses→points at its profile's rate, so one
// "forge a sword" lifts Bladesmithing quickly, Weaponsmithing slower, Smithing
// slowest — from a single event. Profiles are named so a node just tags its
// speed tier; a band applies while `points < upTo`. Numbers are the owner's
// worked example (2026-07-05), 🟡 tunable.

export interface GrowthBand {
   /** This band's uses-per-point applies while the node's points are below this. */
   upTo: number;
   usesPerPoint: number;
}

export interface GrowthProfile {
   /** Ascending bands; the last one should reach SKILL_NODE_CAP. */
   bands: readonly [GrowthBand, ...GrowthBand[]];
}

// The curve follows the owner's worked example (2026-07-07): ~10 uses per point
// when a fighting skill is fresh, ~100 per point once it sits around 20 — with
// knees at 20 and 40 so the wall rises in steps, not one cliff. An equal-strength
// fight/check credits 1.0 use; training weights (combat/training.ts,
// checkTrainingWeight) stretch or shrink what one action is worth.
export const GROWTH_PROFILES = {
   // A general root: broad but deliberately slow — it feeds every branch below
   // it (the whole path sums into Effective), so it must crawl.
   root: { bands: [{ upTo: 5, usesPerPoint: 10 }, { upTo: 10, usesPerPoint: 50 }, { upTo: 20, usesPerPoint: 100 }, { upTo: 40, usesPerPoint: 200 }, { upTo: 100, usesPerPoint: 400 }] },
   // A mid branch: moderate — the owner's 10→100-by-20 example curve.
   branch: { bands: [{ upTo: 5, usesPerPoint: 10 }, { upTo: 10, usesPerPoint: 30 }, { upTo: 20, usesPerPoint: 60 }, { upTo: 40, usesPerPoint: 100 }, { upTo: 100, usesPerPoint: 200 }] },
   // A specialised leaf: quick to build, where a specialist actually lives.
   leaf: { bands: [{ upTo: 5, usesPerPoint: 5 }, { upTo: 10, usesPerPoint: 20 }, { upTo: 20, usesPerPoint: 40 }, { upTo: 40, usesPerPoint: 80 }, { upTo: 100, usesPerPoint: 150 }] },
} as const satisfies Record<string, GrowthProfile>;

export type GrowthProfileId = keyof typeof GROWTH_PROFILES;

/** Max points a node reaches through ordinary practice. 🟡 Mastery (>100) via
 *  special sources — commissions, instructors — is a future extension (RPG/ §7). */
export const SKILL_NODE_CAP = 100;

// --- The tree --------------------------------------------------------------

/** A weighted governing blend: `{ strength: 0.25, charisma: 0.25 }` means the
 *  attribute term is 0.25·STR + 0.25·CHA. Weights are literal multipliers on the
 *  raw attribute (not normalised), so "what a skill depends on" is one edit. */
export type AttributeWeights = Partial<Record<AttributeKey, number>>;

export interface SkillNode {
   name: string;
   /** Parent node id, or null for a tree root. Validated by the catalog test. */
   parent: string | null;
   /** Governing attribute blend. Omitted ⇒ inherited from the nearest ancestor
    *  that declares one (set CHA once on Speechcraft; override only on Intimidate). */
   attributes?: AttributeWeights;
   /** Training speed. Omitted ⇒ defaulted by depth (root/branch/leaf). */
   growth?: GrowthProfileId;
   /** Points reachable by ordinary practice. Omitted ⇒ SKILL_NODE_CAP. */
   cap?: number;
   description?: string;
}

export const SKILL_NODES = {
   // === Smithing — the crafting worked example (low attribute weight; the sum
   // is what matters, and it can run high → crafting quality) ================
   smithing: { name: 'Smithing', parent: null, attributes: { intelligence: 0.2, dexterity: 0.1 }, description: 'Working metal at the forge — the foundation of every smith.' },
   weaponsmithing: { name: 'Weaponsmithing', parent: 'smithing', description: 'Forging arms rather than tools or plate.' },
   bladesmithing: { name: 'Bladesmithing', parent: 'weaponsmithing', description: 'Swords, daggers and knives.' },
   axesmithing: { name: 'Axesmithing', parent: 'weaponsmithing', description: 'Axes and cleaving heads.' },
   // A per-node override: hafted bludgeons are brute stock, so this leaf leans on
   // strength where its siblings inherit the tree's intelligence/dexterity blend.
   haftsmithing: { name: 'Haftsmithing', parent: 'weaponsmithing', attributes: { strength: 0.2, dexterity: 0.1 }, description: 'Maces, hammers and hafted heads.' },
   armoursmithing: { name: 'Armoursmithing', parent: 'smithing', description: 'Shaping protection rather than weapons.' },
   light_armoursmithing: { name: 'Light Armoursmithing', parent: 'armoursmithing', description: 'Mail, brigandine and lighter plate.' },
   heavy_armoursmithing: { name: 'Heavy Armoursmithing', parent: 'armoursmithing', description: 'Full plate — bronze needs the polcan Bronzeforged trait.' },

   // === Metallurgy — the cross-tree MATERIAL path a recipe also draws on (a
   // longsword sums the smithing path AND iron_metallurgy) ===================
   metallurgy: { name: 'Metallurgy', parent: null, attributes: { intelligence: 0.2 }, description: 'Knowing ores, alloys and how metal behaves in the fire.' },
   iron_metallurgy: { name: 'Iron & Steel', parent: 'metallurgy', description: 'Smelting and working iron and steel.' },
   bronze_metallurgy: { name: 'Bronze', parent: 'metallurgy', description: 'The polcan monopoly — alloying tin and copper.' },

   // === Speechcraft — the cross-attribute BLEND demo (each leaf depends on a
   // different mix; higher attribute weight, social skills lean on the person) =
   speechcraft: { name: 'Speechcraft', parent: null, attributes: { charisma: 0.5 }, growth: 'branch', description: 'Bending others with words.' },
   persuade: { name: 'Persuade', parent: 'speechcraft', description: 'Reason, charm and appeal — pure charisma.' },
   // The owner's example: menace is half presence, half muscle.
   intimidate: { name: 'Intimidate', parent: 'speechcraft', attributes: { charisma: 0.25, strength: 0.25 }, description: 'Menace — 50% charisma, 50% raw strength.' },
   deceit: { name: 'Deceit', parent: 'speechcraft', attributes: { charisma: 0.25, intelligence: 0.25 }, description: 'A convincing lie needs charm and a quick mind.' },

   // === Physical — Athletics (keeps the swim check working; attribute-heavy so
   // a non-opposed test vs a fixed difficulty stays fair) ====================
   athletics: { name: 'Athletics', parent: null, attributes: { agility: 1 }, description: 'Running, jumping, hauling, clambering.' },
   swimming: { name: 'Swimming', parent: 'athletics', attributes: { agility: 1 }, description: 'Staying afloat and making headway in water.' },
   climbing: { name: 'Climbing', parent: 'athletics', description: 'Scaling walls, trees and sheer ground.' },

   // === Perception — Awareness (the design list roots it under Perception; the
   // travel challenges' spot/search options draw on and train it — D40) ======
   awareness: { name: 'Awareness', parent: null, attributes: { perception: 1 }, description: 'Noticing what others walk past — movement, gaps, glints.' },
   searching: { name: 'Searching', parent: 'awareness', description: 'Deliberate scouring — a way through, a thing lost, a thing hidden.' },

   // === Combat — placeholder weapon/brawl roots (combat weight ~0.5 per the
   // opposed-roll model; no live solo consumer yet — sparring uses the old
   // engine — so the magnitude is free to tune) =============================
   melee: { name: 'Melee', parent: null, attributes: { agility: 0.5 }, description: 'Fighting hand-to-hand with a weapon.' },
   // Armed STYLE branches (D41/D42) live INSIDE each grip branch (owner's call:
   // one-handed and two-handed fighting are different systems — a sword-and-hand
   // ward is not a greatsword ward). A fighting style (game/combat/styles.ts)
   // draws on its grip's style node — summed into the attack alongside the weapon
   // branch (extraNodes; the shared grip+melee path dedups) and the base of the
   // style's defence, so knowing your style well means attacking AND defending
   // better in it. Explicit `growth: 'branch'` keeps them training at the same
   // rate as the unarmed style branches (their depth would default them to leaf).
   one_handed: { name: 'One-Handed', parent: 'melee', description: 'Single-hand weapons, freeing a hand for a shield.' },
   blades: { name: 'Blades', parent: 'one_handed', description: 'Swords and daggers.' },
   axes_maces: { name: 'Axes & Maces', parent: 'one_handed', description: 'One-handed choppers and bludgeons.' },
   pressing: { name: 'Pressing', parent: 'one_handed', growth: 'branch', description: 'Relentless single-hand offence — point and edge, pressure over caution.' },
   binding: { name: 'Binding', parent: 'one_handed', growth: 'branch', description: 'Binds, hooks and beats — fouling the foe\'s weapon and rhythm.' },
   warding: { name: 'Warding', parent: 'one_handed', growth: 'branch', description: 'A measured single-hand guard — parries, distance and patient counters.' },
   two_handed: { name: 'Two-Handed', parent: 'melee', description: 'Great weapons wielded in both hands.' },
   great_blades: { name: 'Great Blades', parent: 'two_handed', description: 'Greatswords and longblades.' },
   polearms: { name: 'Polearms', parent: 'two_handed', description: 'Spears, halberds and reach weapons.' },
   cleaving: { name: 'Cleaving', parent: 'two_handed', growth: 'branch', description: 'Great committed blows — weight and momentum over caution.' },
   halfswording: { name: 'Halfswording', parent: 'two_handed', growth: 'branch', description: 'Gripping blade or haft to bind, hook and wrestle the foe\'s weapon.' },
   iron_ward: { name: 'Iron Ward', parent: 'two_handed', growth: 'branch', description: 'The braced two-handed guard — let the storm break, then answer.' },
   ranged: { name: 'Ranged', parent: null, attributes: { dexterity: 0.5 }, description: 'Bows, slings and thrown weapons.' },
   // The brawling branches double as the unarmed STYLES' nodes (D41): unarmed,
   // the technique IS the approach, so a style draws its attack and defence
   // straight from its branch (Striker→striking, Grappler→grappling…).
   brawling: { name: 'Brawling', parent: null, attributes: { agility: 0.5 }, description: 'Unarmed fighting — the Smackdown Spire staple.' },
   striking: { name: 'Striking', parent: 'brawling', description: 'Punches, kicks, knees and natural weapons.' },
   grappling: { name: 'Grappling', parent: 'brawling', description: 'Clinches, throws and holds — control the body, smother the fight.' },
   guard: { name: 'Guard', parent: 'brawling', description: 'Blocks, slips and footwork — the art of not being hit.' },
} as const satisfies Record<string, SkillNode>;

export type SkillNodeId = keyof typeof SKILL_NODES;

export const SKILL_NODE_IDS = Object.keys(SKILL_NODES) as SkillNodeId[];

/** The tree roots (each the top of its own tree), in catalog order — the top
 *  level the skill panel lists. */
export const SKILL_ROOT_IDS = SKILL_NODE_IDS.filter((id) => SKILL_NODES[id].parent === null);

/** Type guard for an id read off a DB doc / customId (D10 rule 3). */
export function isSkillNodeId(id: string): id is SkillNodeId {
   return id in SKILL_NODES;
}

/** Direct children of a node, in catalog order (empty for a leaf). */
export function childrenOf(id: SkillNodeId): SkillNodeId[] {
   return SKILL_NODE_IDS.filter((child) => SKILL_NODES[child].parent === id);
}

/** A node and all its descendants, depth-first (parent before its children) —
 *  the natural display order for a whole tree. */
export function subtreeIds(rootId: SkillNodeId): SkillNodeId[] {
   const out: SkillNodeId[] = [];
   const walk = (id: SkillNodeId): void => {
      out.push(id);
      for (const child of childrenOf(id))
         walk(child);
   };
   walk(rootId);
   return out;
}

/** A node widened to `SkillNode` — `as const satisfies` narrows each literal and
 *  hides the optional fields (`attributes`/`growth`/`cap`) on entries that omit
 *  them; go through this to read them uniformly. */
export function skillNode(id: SkillNodeId): SkillNode {
   return SKILL_NODES[id];
}

/** The path from a node up to its root, leaf-first: `[bladesmithing,
 *  weaponsmithing, smithing]`. Every node the character trains when they use
 *  this one, and every node summed into its Effective. */
export function pathToRoot(id: SkillNodeId): SkillNodeId[] {
   const path: SkillNodeId[] = [];
   const seen = new Set<SkillNodeId>();
   let current: SkillNodeId | null = id;

   // The `seen` guard makes a malformed cyclic catalog terminate (and fail the
   // catalog test) instead of looping forever.
   while (current && !seen.has(current)) {
      seen.add(current);
      path.push(current);
      const parent: string | null = skillNode(current).parent;
      current = parent && isSkillNodeId(parent) ? parent : null;
   }

   return path;
}

/** Tree depth: a root is 0, its children 1, … (used for the default growth tier). */
export function nodeDepth(id: SkillNodeId): number {
   return pathToRoot(id).length - 1;
}

/** The growth profile that governs a node — explicit, else defaulted by depth. */
export function growthProfileFor(id: SkillNodeId): GrowthProfile {
   const node = skillNode(id);
   if (node.growth)
      return GROWTH_PROFILES[node.growth];

   const depth = nodeDepth(id);
   return GROWTH_PROFILES[depth === 0 ? 'root' : depth === 1 ? 'branch' : 'leaf'];
}

/** The attribute blend that governs a node's check — its own, or the nearest
 *  ancestor's (inheritance). `{}` only if nothing on the path declares one. */
export function resolveBlend(id: SkillNodeId): AttributeWeights {
   for (const nodeId of pathToRoot(id)) {
      const blend = skillNode(nodeId).attributes;
      if (blend)
         return blend;
   }

   return {};
}
