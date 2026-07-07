import { randomInt } from '../../lib/random.js';
import { rollAgainst } from '../checks.js';
import type { SkillNodeId } from '../data/skills.js';

// The REAL combat engine (Ruleset/combat.md R12/R24) — pure, no Discord, no DB:
// it deals only in the numbers profile.ts derives, so it stays unit-testable
// (inject `rng`). This is the serious, HP-persisting model behind `/smackdown
// duel`; the old d20 engine.ts stays as the throwaway for-fun sparring resolver.
//
// v1 is DELIBERATELY thin (owner's instruction): opposed d100, one shared Health
// pool, Soak, auto-resolve. The layers combat.md defers — fighting styles,
// named signature moves, hit-location trauma tallies + concentrated-damage
// critical injuries, armour × weapon-type multipliers, criticals/fumbles on
// doubles, stances — are NOT built here yet, but every one of them has a marked
// SEAM (a field carried but unused, or a step in `computeDamage`) so adding it is
// filling in a hook, not reshaping the engine.

/** Weapon damage family — carried on the profile for the future armour × type
 *  multiplier (combat.md); NOT yet consumed by damage math (v1). */
export type DamageType = 'slash' | 'pierce' | 'impact';

/** The casual tactical handle (combat.md). v1 always resolves as 'balanced';
 *  the pre-fight stance/style menu is a later layer that only tunes the numbers
 *  the engine already reads. */
export type Stance = 'aggressive' | 'balanced' | 'defensive';

/**
 * A fully-derived, engine-ready combatant. All the character/skill/equipment
 * lookups happen once in profile.ts; the engine never touches a CharacterDoc.
 * Fields tagged SEAM are inert in v1 — present so the deferred layers slot in.
 */
export interface CombatProfile {
   characterId: string;
   name: string;
   maxHealth: number;
   /** Starting current HP — the character's REAL, persistent health (it does not
    *  reset between duels; damage is written back after the fight). */
   health: number;
   /** d100 % to land a blow (skill-tree Effective + attributes, clamped [5,95]). */
   attackTarget: number;
   /** The skill node this fighter's blows draw on AND train (learn-by-doing —
    *  the whole path root→leaf is credited after the bout). Not read by the
    *  engine itself; carried for the post-fight `creditSkillUse`. */
   attackNode: SkillNodeId;
   /** d100 % to evade/parry a blow. */
   defenseTarget: number;
   /** Base weapon (or unarmed) damage, rolled per hit. */
   damage: { min: number; max: number };
   /** SEAM (combat.md armour × weapon-type): not consumed by damage yet. */
   damageType: DamageType;
   strengthBonus: number;
   /** ConstitutionBonus + total Armour Value (never "AP" — that's Action Points). */
   soak: number;
   /** AgilityBonus + PerceptionBonus — decides who strikes first. */
   initiative: number;
   /** SEAM (combat.md stances/styles): always 'balanced' in v1. */
   stance: Stance;
}

/** One resolved exchange (attacker swings, defender evades or is hit). */
export interface DuelBlow {
   attackerId: string;
   defenderId: string;
   hit: boolean;
   damage: number;
   attackRoll: number;
   defenseRoll: number;
   /** The opposed margin on a hit (0 on a miss) — drives damage (combat.md). */
   netSuccessLevels: number;
   defenderHealthAfter: number;
   /** True once the defender's Health hit 0 (Downed — combat.md R8). */
   defenderDowned: boolean;
}

export interface DuelResult {
   winnerId: string;
   loserId: string;
   blows: DuelBlow[];
   /** Post-fight current Health per combatant — persisted by the caller. */
   finalHealth: Record<string, number>;
   /** True if it ended by a knockout (someone reached 0), false if by the round
    *  cap (decided on remaining Health — a rare armour-stalemate; combat.md's
    *  Fatigue-erodes-Soak rule is the intended future fix). */
   knockout: boolean;
}

/** Inclusive integer roll — matches lib/random's `randomInt`; injected in tests. */
export type Rng = (min: number, max: number) => number;

// Safety bound on narrated exchanges. The ≥1-damage-on-connect rule guarantees a
// fight eventually ends; the cap only catches a deep Soak-stalemate, decided on
// remaining Health. Kept modest so a bout never floods the channel. 🟡 tunable.
export const MAX_ROUNDS = 24;

/**
 * Auto-resolves a whole duel in one pass (combat.md R24: v1 is auto-resolve,
 * manual turn-by-turn is a later layer that reuses this same profile/round math).
 * Alternating single exchanges, first strike to the higher Initiative — the
 * proven sparring narration shape, now on real d100/Health/Soak.
 */
export function resolveDuel(a: CombatProfile, b: CombatProfile, rng: Rng = randomInt): DuelResult {
   const health: Record<string, number> = { [a.characterId]: a.health, [b.characterId]: b.health };
   const blows: DuelBlow[] = [];

   // Initiative decides the first attacker; an exact tie is a coin flip.
   let attacker = a.initiative > b.initiative ? a
      : b.initiative > a.initiative ? b
         : (rng(0, 1) === 0 ? a : b);
   let defender = attacker.characterId === a.characterId ? b : a;

   for (let round = 0; round < MAX_ROUNDS && health[a.characterId] > 0 && health[b.characterId] > 0; round++) {
      const blow = exchange(attacker, defender, rng);
      health[defender.characterId] = Math.max(0, health[defender.characterId] - blow.damage);

      blows.push({
         ...blow,
         defenderHealthAfter: health[defender.characterId],
         defenderDowned: health[defender.characterId] <= 0,
      });

      [attacker, defender] = [defender, attacker];
   }

   const aHp = health[a.characterId];
   const bHp = health[b.characterId];
   const knockout = aHp <= 0 || bHp <= 0;

   // Winner: whoever has Health left; on a round-cap tie, the fighter who landed
   // the last blow (initiative/pressure edge). blows is always non-empty.
   const winnerId = aHp === bHp
      ? blows[blows.length - 1].attackerId
      : aHp > bHp ? a.characterId : b.characterId;
   const loserId = winnerId === a.characterId ? b.characterId : a.characterId;

   return { winnerId, loserId, blows, finalHealth: { [a.characterId]: aHp, [b.characterId]: bHp }, knockout };
}

/** One opposed exchange. Both roll their own d100 test; the higher Success Level
 *  connects (a skill-tiebreak favours the sharper fighter, else the defender). */
function exchange(attacker: CombatProfile, defender: CombatProfile, rng: Rng): Omit<DuelBlow, 'defenderHealthAfter' | 'defenderDowned'> {
   const atk = rollAgainst(attacker.attackTarget, rng(1, 100));
   const def = rollAgainst(defender.defenseTarget, rng(1, 100));

   const hit = atk.successLevels > def.successLevels
      || (atk.successLevels === def.successLevels && attacker.attackTarget > defender.defenseTarget);
   const netSuccessLevels = hit ? Math.max(0, atk.successLevels - def.successLevels) : 0;
   const damage = hit ? computeDamage(attacker, defender, netSuccessLevels, rng) : 0;

   return { attackerId: attacker.characterId, defenderId: defender.characterId, hit, damage, attackRoll: atk.roll, defenseRoll: def.roll, netSuccessLevels };
}

/** Damage of a connecting blow: `weapon + net SL + StrengthBonus − Soak`, floored
 *  to the ≥1 anti-stalemate rule (combat.md). The commented steps are the layer
 *  insertion points, in the order combat.md stacks them. */
function computeDamage(attacker: CombatProfile, defender: CombatProfile, netSuccessLevels: number, rng: Rng): number {
   let damage = rng(attacker.damage.min, attacker.damage.max) + netSuccessLevels + attacker.strengthBonus;

   // SEAM (combat.md): armour × weapon-type multiplier applied to raw damage —
   //   damage = Math.round(damage * typeMultiplier(attacker.damageType, defender.armourType));
   damage -= defender.soak;
   // SEAM (combat.md R21): criticals/fumbles on doubles, and the hit-location
   // trauma tally → concentrated-damage critical injury, adjust here.

   // A connecting hit always bites for at least 1 (the anti-Soak-stalemate rule).
   return Math.max(1, damage);
}
