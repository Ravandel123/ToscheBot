import { fightingStyle, type FightingStyleId } from './styles.js';
import type { CombatProfile } from './duel.js';
import type { SkillNodeId } from '../data/skills.js';

// Learn-by-doing for COMBAT (Ruleset/skills.md "Training weight"): how much one
// bout is worth in skill uses. Pure — reads only the two engine-ready profiles,
// so it prices PvP duels and PvE champions (hand-authored stat blocks) alike.
//
// The owner's rule: a stronger opponent teaches more, a much weaker one teaches
// nothing at all. Both fighters (or the trial player) are credited win or lose —
// a real fight has a real cost either way (the "meaningful use" house rule);
// what scales is only how instructive the opposition was. 🟡 constants tunable.

/** A foe at or below this fraction of your power teaches nothing (weight 0). */
export const TRIVIAL_FOE_RATIO = 0.5;

/** Cap on what one bout can be worth, however monstrous the foe. */
export const MAX_TRAINING_WEIGHT = 2;

/**
 * A single "how dangerous is this fighter" score from the profile's own numbers.
 * Attack/defence targets carry the skill+attribute term; damage, Soak and the
 * Health pool weigh the physical build. Only RELATIVE power matters (weights
 * feed a ratio), so the scale is arbitrary — legibility over precision. 🟡
 */
export function combatPower(profile: CombatProfile): number {
   const averageDamage = (profile.damage.min + profile.damage.max) / 2;

   return profile.attackTarget
      + profile.defenseTarget
      + 2 * (averageDamage + profile.strengthBonus)
      + 2 * profile.soak
      + profile.maxHealth / 2;
}

/**
 * The skill uses one bout against `foe` is worth to `self`:
 *  - an equal → 1.0 (the growth bands' baseline: ~10 early fights per point);
 *  - a stronger foe → up to MAX_TRAINING_WEIGHT (linear in the power ratio);
 *  - a weaker foe → falls off linearly, hitting 0 at TRIVIAL_FOE_RATIO — beating
 *    up novices teaches a veteran nothing (the anti-farm: a cleared Spire rung's
 *    rematch naturally decays to worthless as the player outgrows it).
 */
export function trainingWeight(self: CombatProfile, foe: CombatProfile): number {
   const ratio = combatPower(foe) / Math.max(1, combatPower(self));
   if (ratio >= 1)
      return Math.min(MAX_TRAINING_WEIGHT, ratio);

   return Math.max(0, (ratio - TRIVIAL_FOE_RATIO) / (1 - TRIVIAL_FOE_RATIO));
}

/**
 * The skill nodes one fighter's bout actually exercised (D41): each style they
 * fought in trains its own branch (you practise what you did — a whole bout in
 * Grappler banks nothing into Striking), a plain stretch trains the base attack
 * node, and an armed fighter keeps training the weapon branch under any style
 * (the blade is still doing the cutting). `creditUse` dedupes shared parents.
 */
export function trainingNodes(profile: CombatProfile, stylesUsed: readonly (FightingStyleId | null)[]): SkillNodeId[] {
   const nodes = new Set<SkillNodeId>();

   for (const styleId of stylesUsed.length > 0 ? stylesUsed : [null]) {
      if (styleId === null) {
         nodes.add(profile.attackNode);
         continue;
      }
      nodes.add(fightingStyle(styleId).node);
      if (profile.family === 'melee')
         nodes.add(profile.attackNode);
   }

   return [...nodes];
}
