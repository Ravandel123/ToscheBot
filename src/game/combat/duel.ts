import { randomInt } from '../../lib/random.js';
import { CHECK_MAX_TARGET, CHECK_MIN_TARGET, rollAgainst } from '../checks.js';
import { fightingStyle, styleEffect, type FightingStyleId, type StyleFamily } from './styles.js';
import { activePlanStyle, type FamilyPlan } from './plan.js';
import type { SkillNodeId } from '../data/skills.js';

// The REAL combat engine (Ruleset/combat.md R12/R24) — pure, no Discord, no DB:
// it deals only in the numbers profile.ts derives, so it stays unit-testable
// (inject `rng`). This is the serious, HP-persisting model behind `/smackdown
// duel`; the old d20 engine.ts stays as the throwaway for-fun sparring resolver.
//
// v1 is DELIBERATELY thin (owner's instruction): opposed d100, one shared Health
// pool, Soak, auto-resolve. Fighting styles + the combat plan are LIVE (D41):
// each exchange re-evaluates both fighters' plans (default style + conditional
// switches), applies the active style's modifiers to the opposed targets and
// runs its effects (hamper, riposte). The layers combat.md still defers — named
// signature moves, hit-location trauma tallies + concentrated-damage critical
// injuries, armour × weapon-type multipliers, criticals/fumbles on doubles,
// `knowsStyle` counter-play — keep their marked SEAMs (a field carried but
// unused, or a step in `computeDamage`) so adding one is filling in a hook, not
// reshaping the engine.

/** Weapon damage family — carried on the profile for the future armour × type
 *  multiplier (combat.md); NOT yet consumed by damage math (v1). */
export type DamageType = 'slash' | 'pierce' | 'impact';

/** Node-derived base d100 targets while a given style is active (modifiers NOT
 *  baked in — the engine applies them per exchange, so a hand-authored champion
 *  without per-style targets still gets a style's modifiers over its bases). */
export interface StyleTargets {
   attack: number;
   defense: number;
}

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
   /** d100 % to land a blow with NO style (skill-tree Effective + attributes,
    *  clamped [5,95]) — the pre-D41 behavior, and every style's fallback base. */
   attackTarget: number;
   /** The skill node plain (style-less) blows draw on AND train (learn-by-doing
    *  — the whole path root→leaf is credited after the bout). Not read by the
    *  engine itself; carried for the post-fight `creditSkillUse`. */
   attackNode: SkillNodeId;
   /** d100 % to evade/parry a blow with no style active. */
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
   /** Which style catalog applies to this fighter (weapon in hand ⇒ melee;
    *  fists ⇒ unarmed) — styles from another family never fire (D41). */
   family: StyleFamily;
   /** Per-style base targets, derived from each style's skill node (the owner's
    *  rule: knowing your style well = attacking AND defending better in it).
    *  A style absent here falls back to attackTarget/defenseTarget. */
   styleTargets?: Partial<Record<FightingStyleId, StyleTargets>>;
   /** Standing orders for this family (default style + conditional switches).
    *  Absent or empty → fights plain, exactly like pre-D41 combat. */
   plan?: FamilyPlan;
}

/** A style change at the top of an exchange (narration flavor). */
export interface StyleSwitch {
   characterId: string;
   style: FightingStyleId;
}

/** A counter-blow the DEFENDER landed on a strong defence (riposte effect). */
export interface RiposteBlow {
   damage: number;
   attackerHealthAfter: number;
   attackerDowned: boolean;
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
   /** Styles in effect this exchange (null = fighting plain). */
   attackerStyle: FightingStyleId | null;
   defenderStyle: FightingStyleId | null;
   /** Plan-driven style changes that happened at the top of this exchange. */
   styleSwitches: StyleSwitch[];
   /** The attacker swung fouled by the foe's previous controlling hit (hamper). */
   hampered: boolean;
   riposte?: RiposteBlow;
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
   /** Each fighter's style at the opening bell (narration). */
   openingStyles: Record<string, FightingStyleId | null>;
   /** The distinct styles each fighter actually fought in, in order of first
    *  use (null = a plain stretch) — drives post-fight training (D40/D41). */
   stylesUsed: Record<string, (FightingStyleId | null)[]>;
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
   // A hamper (grapple/bind) fouls the victim's NEXT swing — consumed when they attack.
   const pendingHamper: Record<string, number> = { [a.characterId]: 0, [b.characterId]: 0 };
   const currentStyle: Record<string, FightingStyleId | null> = {};
   const openingStyles: Record<string, FightingStyleId | null> = {};
   const stylesUsed: Record<string, (FightingStyleId | null)[]> = { [a.characterId]: [], [b.characterId]: [] };

   // Initiative decides the first attacker; an exact tie is a coin flip.
   let attacker = a.initiative > b.initiative ? a
      : b.initiative > a.initiative ? b
         : (rng(0, 1) === 0 ? a : b);
   let defender = attacker.characterId === a.characterId ? b : a;

   for (let round = 1; round <= MAX_ROUNDS && health[a.characterId] > 0 && health[b.characterId] > 0; round++) {
      // Re-evaluate both plans at the top of the exchange. Triggers are
      // monotonic (Health only falls, the round only rises), so styles never
      // flap — a fired rule stays fired for the rest of the fight.
      const styleSwitches: StyleSwitch[] = [];
      for (const [self, foe] of [[attacker, defender], [defender, attacker]] as const) {
         const style = resolveStyle(self, foe, round, health);
         if (round === 1)
            openingStyles[self.characterId] = style;
         else if (style !== currentStyle[self.characterId] && style !== null)
            styleSwitches.push({ characterId: self.characterId, style });

         currentStyle[self.characterId] = style;
         const used = stylesUsed[self.characterId];
         if (!used.includes(style))
            used.push(style);
      }

      const blow = exchange(attacker, defender, currentStyle, pendingHamper, rng);
      health[defender.characterId] = Math.max(0, health[defender.characterId] - blow.record.damage);
      if (blow.riposteDamage > 0)
         health[attacker.characterId] = Math.max(0, health[attacker.characterId] - blow.riposteDamage);

      blows.push({
         ...blow.record,
         styleSwitches,
         defenderHealthAfter: health[defender.characterId],
         defenderDowned: health[defender.characterId] <= 0,
         riposte: blow.riposteDamage > 0
            ? {
               damage: blow.riposteDamage,
               attackerHealthAfter: health[attacker.characterId],
               attackerDowned: health[attacker.characterId] <= 0,
            }
            : undefined,
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

   return {
      winnerId,
      loserId,
      blows,
      finalHealth: { [a.characterId]: aHp, [b.characterId]: bHp },
      knockout,
      openingStyles,
      stylesUsed,
   };
}

/** The style a fighter's plan puts them in right now (null = fight plain). */
function resolveStyle(self: CombatProfile, foe: CombatProfile, round: number, health: Record<string, number>): FightingStyleId | null {
   if (!self.plan)
      return null;

   return activePlanStyle(self.plan, {
      round,
      selfHealthPercent: (health[self.characterId] / Math.max(1, self.maxHealth)) * 100,
      foeHealthPercent: (health[foe.characterId] / Math.max(1, foe.maxHealth)) * 100,
   });
}

/** A style's node-derived base targets, falling back to the profile's plain
 *  bases (hand-authored champions carry no per-style targets). */
function styleBases(profile: CombatProfile, style: FightingStyleId | null): StyleTargets {
   if (style) {
      const derived = profile.styleTargets?.[style];
      if (derived)
         return derived;
   }

   return { attack: profile.attackTarget, defense: profile.defenseTarget };
}

/** Styles shift targets, but the roll-under floor/cap still holds (R1). */
function clampTarget(target: number): number {
   return Math.max(CHECK_MIN_TARGET, Math.min(CHECK_MAX_TARGET, Math.round(target)));
}

interface ExchangeOutcome {
   record: Omit<DuelBlow, 'defenderHealthAfter' | 'defenderDowned' | 'styleSwitches' | 'riposte'>;
   /** Counter damage the defender dealt back (0 = none). */
   riposteDamage: number;
}

/** One opposed exchange. Both roll their own d100 test under their active
 *  style's targets/modifiers; the higher Success Level connects (a target
 *  tiebreak favours the sharper fighter, else the defender). */
function exchange(
   attacker: CombatProfile,
   defender: CombatProfile,
   styles: Record<string, FightingStyleId | null>,
   pendingHamper: Record<string, number>,
   rng: Rng,
): ExchangeOutcome {
   const attackerStyle = styles[attacker.characterId];
   const defenderStyle = styles[defender.characterId];

   // A hamper from the foe's last connecting hit fouls exactly this one swing.
   const hamperPenalty = pendingHamper[attacker.characterId];
   pendingHamper[attacker.characterId] = 0;

   const attackTarget = clampTarget(
      styleBases(attacker, attackerStyle).attack
      + (attackerStyle ? fightingStyle(attackerStyle).modifiers?.attack ?? 0 : 0)
      - hamperPenalty,
   );
   const defenseTarget = clampTarget(
      styleBases(defender, defenderStyle).defense
      + (defenderStyle ? fightingStyle(defenderStyle).modifiers?.defense ?? 0 : 0),
   );

   const atk = rollAgainst(attackTarget, rng(1, 100));
   const def = rollAgainst(defenseTarget, rng(1, 100));

   const hit = atk.successLevels > def.successLevels
      || (atk.successLevels === def.successLevels && attackTarget > defenseTarget);
   const netSuccessLevels = hit ? Math.max(0, atk.successLevels - def.successLevels) : 0;
   const damage = hit ? computeDamage(attacker, defender, attackerStyle, netSuccessLevels, rng) : 0;

   // Hamper (grapple/bind): a connecting controlling hit fouls the foe's next attack.
   const hamper = styleEffect(attackerStyle, 'hamper');
   if (hit && hamper)
      pendingHamper[defender.characterId] = Math.max(pendingHamper[defender.characterId], hamper.attackPenalty);

   // Riposte: a defence won by a wide enough margin answers with a counter-blow
   // (through the attacker's Soak, floored to the ≥1 connecting-hit rule).
   const riposte = styleEffect(defenderStyle, 'riposte');
   const riposteDamage = !hit && riposte && def.successLevels - atk.successLevels >= riposte.minMargin
      ? Math.max(1, rng(riposte.damage.min, riposte.damage.max) + defender.strengthBonus - attacker.soak)
      : 0;

   return {
      record: {
         attackerId: attacker.characterId,
         defenderId: defender.characterId,
         hit,
         damage,
         attackRoll: atk.roll,
         defenseRoll: def.roll,
         netSuccessLevels,
         attackerStyle,
         defenderStyle,
         hampered: hamperPenalty > 0,
      },
      riposteDamage,
   };
}

/** Damage of a connecting blow: `weapon + net SL + StrengthBonus [+ style] − Soak`,
 *  floored to the ≥1 anti-stalemate rule (combat.md). The commented steps are the
 *  layer insertion points, in the order combat.md stacks them. */
function computeDamage(attacker: CombatProfile, defender: CombatProfile, attackerStyle: FightingStyleId | null, netSuccessLevels: number, rng: Rng): number {
   let damage = rng(attacker.damage.min, attacker.damage.max)
      + netSuccessLevels
      + attacker.strengthBonus
      + (attackerStyle ? fightingStyle(attackerStyle).modifiers?.damage ?? 0 : 0);

   // SEAM (combat.md): armour × weapon-type multiplier applied to raw damage —
   //   damage = Math.round(damage * typeMultiplier(attacker.damageType, defender.armourType));
   damage -= defender.soak;
   // SEAM (combat.md R21): criticals/fumbles on doubles, and the hit-location
   // trauma tally → concentrated-damage critical injury, adjust here.

   // A connecting hit always bites for at least 1 (the anti-Soak-stalemate rule).
   return Math.max(1, damage);
}
