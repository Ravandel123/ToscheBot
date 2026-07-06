import { randomInt } from '../lib/random.js';
import { effectiveSkill } from './character/skills.js';
import type { AttributeKey } from './data/attributes.js';
import type { SkillNodeId } from './data/skills.js';
import type { RaceId } from './data/races.js';
import type { CharacterDoc } from '../db/models/character.js';

// The core resolution mechanic: d100, roll-under, with Success Levels — the
// shape locked in RPG/'s R1 (WHFRP-style). A check draws on either a SKILL-TREE
// node (its blend gives the attribute term, its path is summed — the R10 sum
// model, game/character/skills.ts) or a bare attribute (untrained checks like
// climbing a fallen tree). The raw Effective is then shaped into a d100 % by a
// difficulty modifier and any racial affinity (a lutren swims at ×1.5), and
// clamped so nothing is ever certain.

export interface CheckDefinition {
   /** The primary skill node: its attribute blend is the attribute term AND its
    *  path (root→leaf) is summed into the Effective. Omit for an untrained check. */
   node?: SkillNodeId;
   /** Extra skill paths this check also sums (a craft: material + technique). */
   extraNodes?: readonly SkillNodeId[];
   /** Bare governing attribute — used when there is no `node` (an untrained test). */
   attribute?: AttributeKey;
   /** Weight on `attribute` when used directly (default 1 — the whole attribute). */
   attributeWeight?: number;
   /** Difficulty ladder step (RPG/Ruleset.md §2): +20 easy … −30 punishing. */
   modifier?: number;
   /** Racial chance multipliers (1.5 = 50% better odds), applied to the target. */
   raceAffinity?: Partial<Record<RaceId, number>>;
}

export interface CheckResult {
   roll: number;
   target: number;
   success: boolean;
   /** Degrees of success: tens(target) − tens(roll); negative on a failure. */
   successLevels: number;
}

/** Roll-under floor/cap: nothing is impossible, nothing is guaranteed (R1). */
export const CHECK_MIN_TARGET = 5;
export const CHECK_MAX_TARGET = 95;

export type CheckSubject = Pick<CharacterDoc, 'attributes' | 'progression'> & {
   identity: Pick<CharacterDoc['identity'], 'race'>;
};

/**
 * The raw Effective (capability) for a check: a skill node's `attribute blend +
 * Σ path points`, or a bare weighted attribute. UNCAPPED — surplus is Mastery /
 * crafting quality (RPG/ §2). checkTarget shapes and clamps it into a d100 %.
 */
export function checkEffective(subject: CheckSubject, check: CheckDefinition): number {
   if (check.node)
      // `?? {}` tolerates a pre-D34 character doc with no progression (lean reads
      // don't apply the schema default) — an untrained sum, never a crash.
      return effectiveSkill(subject.attributes, subject.progression?.skills ?? {}, { node: check.node, extraNodes: check.extraNodes });
   if (check.attribute)
      return (check.attributeWeight ?? 1) * subject.attributes[check.attribute];
   return 0;
}

/** The d100 target this character rolls under: Effective shaped by difficulty and
 *  racial affinity, clamped to [5, 95]. Pure. */
export function checkTarget(subject: CheckSubject, check: CheckDefinition): number {
   const affinity = (subject.identity.race ? check.raceAffinity?.[subject.identity.race] : undefined) ?? 1;
   const target = (checkEffective(subject, check) + (check.modifier ?? 0)) * affinity;

   return Math.max(CHECK_MIN_TARGET, Math.min(CHECK_MAX_TARGET, Math.round(target)));
}

/** Rolls d100 against a precomputed target. `roll` is injectable for tests
 *  (and for stored-target replays — see the challenge activity). */
export function rollAgainst(target: number, roll = randomInt(1, 100)): CheckResult {
   return {
      roll,
      target,
      success: roll <= target,
      successLevels: Math.floor(target / 10) - Math.floor(roll / 10),
   };
}

/** Convenience: derive the target from the subject and roll it in one go. */
export function rollCheck(subject: CheckSubject, check: CheckDefinition): CheckResult {
   return rollAgainst(checkTarget(subject, check));
}
