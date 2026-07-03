import { randomInt } from '../lib/random.js';
import type { AttributeKey } from './data/attributes.js';
import type { SkillKey } from './data/skills.js';
import type { RaceId } from './data/races.js';
import type { CharacterDoc } from '../db/models/character.js';

// The core resolution mechanic: d100, roll-under, with Success Levels — the
// shape locked in RPG/'s R1 (WHFRP-style). A check's target is the governing
// attribute, plus a placeholder skill bonus, plus a difficulty modifier, then
// scaled by any racial affinity (a lutren swims at ×1.5) and clamped so nothing
// is ever certain. 🟡 The skill term is a stopgap until RPG/'s P-skilltree
// locks the real Effective formula (w·attribute + Σ tree nodes); the check
// SHAPE (target %, roll-under, SL) is the stable part consumers build on.

export interface CheckDefinition {
   /** The governing attribute — the bulk of the target. */
   attribute: AttributeKey;
   /** Optional trained skill: adds level × SKILL_CHECK_BONUS_PER_LEVEL. */
   skill?: SkillKey;
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

/** 🟡 Placeholder flat bonus per skill level until the P-skilltree math lands. */
export const SKILL_CHECK_BONUS_PER_LEVEL = 5;
/** Roll-under floor/cap: nothing is impossible, nothing is guaranteed (R1). */
export const CHECK_MIN_TARGET = 5;
export const CHECK_MAX_TARGET = 95;

export type CheckSubject = Pick<CharacterDoc, 'attributes' | 'skills'> & {
   identity: Pick<CharacterDoc['identity'], 'race'>;
};

/** The d100 target this character rolls under for `check`. Pure. */
export function checkTarget(subject: CheckSubject, check: CheckDefinition): number {
   const skillBonus = check.skill ? subject.skills[check.skill].level * SKILL_CHECK_BONUS_PER_LEVEL : 0;
   const affinity = (subject.identity.race && check.raceAffinity?.[subject.identity.race]) || 1;
   const target = (subject.attributes[check.attribute] + skillBonus + (check.modifier ?? 0)) * affinity;

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
