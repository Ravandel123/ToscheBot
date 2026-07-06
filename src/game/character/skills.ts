import {
   SKILL_NODE_CAP,
   growthProfileFor,
   pathToRoot,
   resolveBlend,
   skillNode,
   type SkillNodeId,
} from '../data/skills.js';
import type { AttributeKey } from '../data/attributes.js';

// The skill-tree ENGINE (RPG/ P-skilltree). Pure — no Discord, no DB. Operates
// on a character's SPARSE progression map: only nodes the character has touched
// are stored; an absent node reads as 0 points (M0-friendly, D32). The tree
// SHAPE lives in game/data/skills.ts; this file turns "points on nodes" into the
// two things the game reads — a check's Effective and learn-by-doing growth.

export interface SkillNodeState {
   /** Trained value 0..cap; the sum of these along a path drives Effective. */
   points: number;
   /** Uses banked toward the next point (learn-by-doing). */
   progress: number;
}

/** The sparse map stored on the character — only non-zero nodes are present. */
export type SkillProgression = Partial<Record<SkillNodeId, SkillNodeState>>;

/** The `progression` subdoc (D32). Only `skills` is real today; talents/points
 *  join it when those phases land — stored as a plain object so growing the
 *  shape needs no migration. */
export interface CharacterProgression {
   skills: SkillProgression;
}

export function emptyProgression(): CharacterProgression {
   return { skills: {} };
}

/** Points on one node (0 if the character has never trained it). */
export function nodePoints(progression: SkillProgression, id: SkillNodeId): number {
   return progression[id]?.points ?? 0;
}

/** The UNIQUE set of nodes reached by walking every given node up to its root —
 *  what a check sums and what a use trains. Deduped so a recipe drawing on two
 *  sibling leaves never counts their shared parent twice. */
export function pathNodeSet(nodeIds: readonly SkillNodeId[]): SkillNodeId[] {
   const seen = new Set<SkillNodeId>();
   for (const id of nodeIds)
      for (const node of pathToRoot(id))
         seen.add(node);

   return [...seen];
}

/** Σ points over the unique path nodes of the referenced skills (root→leaf). */
export function skillSum(progression: SkillProgression, nodeIds: readonly SkillNodeId[]): number {
   return pathNodeSet(nodeIds).reduce((sum, id) => sum + nodePoints(progression, id), 0);
}

/** The weighted attribute term: Σ weight · attribute over a blend. */
export function attributeTerm(attributes: Record<AttributeKey, number>, id: SkillNodeId): number {
   const blend = resolveBlend(id);
   let term = 0;
   for (const [attr, weight] of Object.entries(blend))
      term += (weight ?? 0) * attributes[attr as AttributeKey];
   return term;
}

/** What a skill test draws on. `node` is the primary skill (its blend gives the
 *  attribute term AND its path is summed); `extraNodes` are additional paths a
 *  recipe also sums (a longsword: swordsmithing + iron metallurgy). */
export interface SkillSpec {
   node: SkillNodeId;
   extraNodes?: readonly SkillNodeId[];
}

/**
 * Raw Effective for a skill spec: `attribute term (primary node's blend) + Σ path
 * points`. UNCAPPED on purpose — a master's surplus over an item's required sum is
 * crafting quality / combat Mastery (RPG/ §2). checks.ts clamps it into a d100 %.
 */
export function effectiveSkill(
   attributes: Record<AttributeKey, number>,
   progression: SkillProgression,
   spec: SkillSpec,
): number {
   return attributeTerm(attributes, spec.node) + skillSum(progression, [spec.node, ...(spec.extraNodes ?? [])]);
}

// --- Learn-by-doing --------------------------------------------------------

/** Uses needed to raise a node from `points` to `points + 1`, per its growth
 *  profile's band. Infinity once the node is capped (ordinary practice stops). */
export function usesForNextPoint(id: SkillNodeId, points: number): number {
   const cap = skillNode(id).cap ?? SKILL_NODE_CAP;
   if (points >= cap)
      return Infinity;

   for (const band of growthProfileFor(id).bands)
      if (points < band.upTo)
         return band.usesPerPoint;

   return Infinity; // points below cap but past every band — treat as capped
}

/** A node that gained a point in a `creditUse` — for the "you improved!" line. */
export interface SkillLevelUp {
   node: SkillNodeId;
   from: number;
   to: number;
}

export interface CreditResult {
   progression: SkillProgression;
   levelUps: SkillLevelUp[];
}

/** Credits ONE meaningful use of the given skills: +1 use to every node on their
 *  paths (leaf, branch, root), converting banked progress to points at each
 *  node's own rate. Pure — returns a new sparse map (existing state untouched)
 *  and the nodes that ranked up. The caller decides an action is "meaningful"
 *  (a real, contested use — RPG/ §7 anti-grind); the engine just applies it. */
export function creditUse(progression: SkillProgression, nodeIds: readonly SkillNodeId[]): CreditResult {
   const next: SkillProgression = { ...progression };
   const levelUps: SkillLevelUp[] = [];

   for (const id of pathNodeSet(nodeIds)) {
      const before = next[id] ?? { points: 0, progress: 0 };
      const cap = skillNode(id).cap ?? SKILL_NODE_CAP;
      let { points, progress } = before;
      progress += 1;

      while (points < cap && progress >= usesForNextPoint(id, points)) {
         progress -= usesForNextPoint(id, points);
         points += 1;
      }
      if (points >= cap)
         progress = 0; // capped — don't hoard progress it can never spend

      if (points > before.points)
         levelUps.push({ node: id, from: before.points, to: points });

      next[id] = { points, progress };
   }

   return { progression: next, levelUps };
}
