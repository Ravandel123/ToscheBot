import { describe, expect, it } from 'vitest';
import { followUpChance, FOLLOW_UP_MAX, MAX_ROUNDS, resolveDuel, type CombatProfile, type Rng } from './duel.js';

// Always rolls the LOW end of any range: d100 → 1 (a strong percentile success),
// damage → its minimum. Deterministic, so an outcome is fully scripted by the
// profiles' targets rather than the dice.
const rngLow: Rng = (min) => min;

// A scripted rng: consumes `rolls` in order (each clamped into the asked range),
// then falls back to the low end. Lets a test script the exact dice a bout sees
// — the engine rolls attack, defence, damage, then the press per exchange.
function seqRng(rolls: number[]): Rng {
   let i = 0;
   return (min, max) => Math.min(max, Math.max(min, rolls[i++] ?? min));
}

function profile(characterId: string, overrides: Partial<CombatProfile> = {}): CombatProfile {
   return {
      characterId,
      name: characterId,
      maxHealth: 20,
      health: 20,
      attackTarget: 50,
      attackNode: 'striking',
      defenseTarget: 40,
      damage: { min: 3, max: 3 },
      damageType: 'impact',
      strengthBonus: 0,
      soak: 0,
      initiative: 5,
      family: 'unarmed',
      ...overrides,
   };
}

describe('resolveDuel', () => {
   it('produces a consistent winner/loser and a non-empty blow log', () => {
      const result = resolveDuel(profile('a', { initiative: 9 }), profile('b', { initiative: 1 }), rngLow);

      expect([result.winnerId, result.loserId].sort()).toEqual(['a', 'b']);
      expect(result.winnerId).not.toBe(result.loserId);
      expect(result.blows.length).toBeGreaterThan(0);
   });

   it('lands the first blow for the higher-Initiative fighter', () => {
      const result = resolveDuel(profile('a', { initiative: 1 }), profile('b', { initiative: 9 }), rngLow);
      expect(result.blows[0].attackerId).toBe('b');
   });

   it('knocks out the fighter whose Health reaches 0 and reports it', () => {
      // A hits reliably (high attack vs low defence) for big damage; B can barely
      // scratch A (low attack vs high defence).
      const strong = profile('a', { attackTarget: 95, defenseTarget: 95, damage: { min: 12, max: 12 }, initiative: 9 });
      const weak = profile('b', { attackTarget: 5, defenseTarget: 5, damage: { min: 1, max: 1 }, initiative: 1 });

      const result = resolveDuel(strong, weak, rngLow);

      expect(result.winnerId).toBe('a');
      expect(result.knockout).toBe(true);
      expect(result.finalHealth.b).toBe(0);
      expect(result.finalHealth.a).toBeGreaterThan(0);
      expect(result.blows.some((blow) => blow.defenderId === 'b' && blow.defenderDowned)).toBe(true);
   });

   it('a connecting hit always deals at least 1, even through heavy Soak', () => {
      const attacker = profile('a', { attackTarget: 95, defenseTarget: 95, damage: { min: 1, max: 1 }, initiative: 9 });
      const wall = profile('b', { attackTarget: 5, defenseTarget: 5, soak: 100, initiative: 1 });

      const result = resolveDuel(attacker, wall, rngLow);
      const landed = result.blows.filter((blow) => blow.hit);

      expect(landed.length).toBeGreaterThan(0);
      expect(landed.every((blow) => blow.damage === 1)).toBe(true);
   });

   it('falls back to remaining Health at the round cap when no one can connect', () => {
      // Both are hopeless attackers against a flawless defender — every exchange
      // misses, so the fight runs to the cap and is decided on Health (a tie here,
      // broken to the last attacker).
      const a = profile('a', { attackTarget: 5, defenseTarget: 95, initiative: 9 });
      const b = profile('b', { attackTarget: 5, defenseTarget: 95, initiative: 1 });

      const result = resolveDuel(a, b, rngLow);

      expect(result.knockout).toBe(false);
      expect(result.blows).toHaveLength(MAX_ROUNDS);
      expect(result.blows.every((blow) => !blow.hit)).toBe(true);
      expect(result.finalHealth.a).toBe(20);
      expect(result.finalHealth.b).toBe(20);
   });

   it('carries a wounded fighter into the duel at their current Health', () => {
      // A starts already hurt (8/20); a decisive foe finishes them faster.
      const hurt = profile('a', { health: 8, attackTarget: 5, defenseTarget: 5, initiative: 1 });
      const fresh = profile('b', { attackTarget: 95, defenseTarget: 95, damage: { min: 10, max: 10 }, initiative: 9 });

      const result = resolveDuel(hurt, fresh, rngLow);

      expect(result.winnerId).toBe('b');
      expect(result.finalHealth.a).toBe(0);
   });
});

describe('fighting styles & the combat plan (D41)', () => {
   it('fights plain (no styles anywhere) when no plan is set', () => {
      const result = resolveDuel(profile('a', { initiative: 9 }), profile('b'), rngLow);

      expect(result.openingStyles).toEqual({ a: null, b: null });
      expect(result.stylesUsed).toEqual({ a: [null], b: [null] });
      expect(result.blows.every((blow) => blow.attackerStyle === null && blow.styleSwitches.length === 0)).toBe(true);
   });

   it('opens in the plan\'s default style and rolls that style\'s node-derived targets', () => {
      // The style's derived base replaces the plain target, then the style's
      // own modifiers apply on top; the +2 damage mod shows up in the blow.
      const striker = profile('a', {
         initiative: 9,
         plan: { style: 'striker', rules: [] },
         styleTargets: { striker: { attack: 80, defense: 30 } },
      });
      const result = resolveDuel(striker, profile('b'), rngLow);

      expect(result.openingStyles.a).toBe('striker');
      const first = result.blows[0];
      expect(first.attackerStyle).toBe('striker');
      // Both roll 1. Attack 80+10=90 → SL 9; b's plain defence 40 → SL 4;
      // net 5. Damage = roll 3 + net 5 + STR 0 + striker damage mod 2.
      expect(first.damage).toBe(3 + 5 + 2);
   });

   it('falls back to the base targets for a style with no derived targets (champions)', () => {
      const styled = profile('a', { initiative: 9, plan: { style: 'striker', rules: [] } });
      const result = resolveDuel(styled, profile('b'), rngLow);

      // No styleTargets → the plain bases carry the style's modifiers: attack
      // 50+10=60 → SL 6 on a roll of 1; defence 40 → SL 4; net 2.
      const first = result.blows[0];
      expect(first.hit).toBe(true);
      expect(first.damage).toBe(3 + 2 + 2);
   });

   it('switches style when a rule fires and reports the switch once', () => {
      // A opens plain and goes Stonewall from round 3 (monotonic trigger).
      const planner = profile('a', {
         initiative: 9,
         attackTarget: 5,
         defenseTarget: 95,
         plan: { style: null, rules: [{ trigger: { kind: 'round-at-least', value: 3 }, style: 'stonewall' }] },
      });
      const foe = profile('b', { attackTarget: 5, defenseTarget: 95 });

      const result = resolveDuel(planner, foe, rngLow);

      expect(result.openingStyles.a).toBeNull();
      const switches = result.blows.flatMap((blow) => blow.styleSwitches);
      expect(switches).toEqual([{ characterId: 'a', style: 'stonewall' }]);
      expect(result.stylesUsed.a).toEqual([null, 'stonewall']);
   });

   it('hamper (Grappler): a connecting hold fouls exactly the foe\'s NEXT swing', () => {
      // Grappler A opens with a run of holds (momentum: hits keep the
      // initiative), then overextends and misses. B's FIRST answer is fouled
      // by the last hold (−15); B's own pressed follow-ups are not — the
      // hamper is consumed by one swing, not a lasting debuff.
      const grappler = profile('a', {
         initiative: 9,
         attackTarget: 95,
         defenseTarget: 5,
         plan: { style: 'grappler', rules: [] },
         styleTargets: { grappler: { attack: 95, defense: 5 } },
         maxHealth: 100,
         health: 100,
      });
      const foe = profile('b', { attackTarget: 95, defenseTarget: 60, maxHealth: 100, health: 100 });

      const result = resolveDuel(grappler, foe, rngLow);
      const foeSwings = result.blows.filter((blow) => blow.attackerId === 'b');

      expect(foeSwings.length).toBeGreaterThan(1);
      // The swing right after A's connecting hold is fouled…
      expect(foeSwings[0].hampered).toBe(true);
      // Hampered attack 95−15=80 → SL 8 on a roll of 1, vs A's defence 5 →
      // SL 0: net 8 (an unfouled swing would net 9). Damage = 3 + net 8.
      expect(foeSwings[0].damage).toBe(3 + 8);
      // …but B's pressed follow-ups swing free (the hold was spent).
      expect(foeSwings.some((blow) => blow.pressed)).toBe(true);
      expect(foeSwings.filter((blow) => blow.pressed).every((blow) => !blow.hampered)).toBe(true);
   });

   it('riposte (Stonewall): a defence won by a wide margin counters, and can down', () => {
      // (unchanged by momentum: every attack here misses, so the initiative
      // simply passes back and forth exactly as it used to.)
      // Both attacks are hopeless (target 5, SL 0) into flawless defences, so
      // no blow ever lands — but the wall's Stonewall defence (85+10=95, SL 9)
      // beats each incoming swing by 9 ≥ minMargin 2 and answers for
      // max(1, 1+0−0) = 1 per miss, grinding the rusher's 3 Health to a KO.
      const wall = profile('a', {
         initiative: 1,
         attackTarget: 5,
         defenseTarget: 95,
         plan: { style: 'stonewall', rules: [] },
         styleTargets: { stonewall: { attack: 5, defense: 85 } },
      });
      const rusher = profile('b', { attackTarget: 5, defenseTarget: 95, health: 3, maxHealth: 20, initiative: 9 });

      const result = resolveDuel(wall, rusher, rngLow);

      const ripostes = result.blows.filter((blow) => blow.riposte);
      expect(ripostes.length).toBeGreaterThan(0);
      expect(ripostes.every((blow) => blow.defenderId === 'a' && (blow.riposte?.damage ?? 0) >= 1)).toBe(true);
      expect(result.winnerId).toBe('a');
      expect(result.knockout).toBe(true);
      expect(result.finalHealth.b).toBe(0);
      expect(result.blows.some((blow) => blow.riposte?.attackerDowned)).toBe(true);
   });
});

// Length of the opening run of consecutive swings by the first attacker.
function firstStreak(result: ReturnType<typeof resolveDuel>): number {
   const first = result.blows[0].attackerId;
   let n = 0;
   for (const blow of result.blows) {
      if (blow.attackerId !== first)
         break;
      n++;
   }
   return n;
}

describe('momentum (D42)', () => {
   it('a bigger skill gap sustains a longer press — the "cut them down" flurry', () => {
      // Under rngLow every positive follow-up chance presses, so the opening run
      // lasts until the chance decays to 0. A lopsided blow (net SL ~8: attack 95
      // into a defence of 15) holds that chance high for many swings, cutting the
      // foe down; a marginal blow (net SL ~1: attack 55 into 45) burns out fast.
      // High HP on the foe so it's the momentum mechanic ending the run, not a KO.
      const dominant = firstStreak(resolveDuel(
         profile('a', { initiative: 9, attackTarget: 95, defenseTarget: 95 }),
         profile('b', { attackTarget: 5, defenseTarget: 15, maxHealth: 300, health: 300 }),
         rngLow));
      const even = firstStreak(resolveDuel(
         profile('a', { initiative: 9, attackTarget: 55, defenseTarget: 95 }),
         profile('b', { attackTarget: 5, defenseTarget: 45, maxHealth: 300, health: 300 }),
         rngLow));

      expect(dominant).toBeGreaterThan(even);
      expect(dominant).toBeGreaterThanOrEqual(8); // a real "10-hit" cut-down is reachable
   });

   it('a landed blow no longer ALWAYS chains — a failed press roll hands the turn over', () => {
      // The core fix: a hit is a chance, not a guarantee. A lands decisively
      // (attack roll 1 vs a defence roll of 100), but the press roll of 100
      // exceeds even the capped 85% chance → the initiative passes despite the
      // hit, instead of the old forced second swing.
      const a = profile('a', { initiative: 9, attackTarget: 60, maxHealth: 100, health: 100 });
      const b = profile('b', { defenseTarget: 40, maxHealth: 100, health: 100 });

      // Per hit the engine rolls: attack, defence, damage, then the press.
      const handsOver = resolveDuel(a, b, seqRng([1, 100, 3, 100]));
      expect(handsOver.blows[0]).toMatchObject({ attackerId: 'a', hit: true });
      expect(handsOver.blows[1].attackerId).toBe('b');

      // Same blow, a winning press roll (1) instead → A does chain a second swing.
      const chains = resolveDuel(a, b, seqRng([1, 100, 3, 1, 1, 100, 3, 100]));
      expect(chains.blows[0]).toMatchObject({ attackerId: 'a', hit: true });
      expect(chains.blows[1]).toMatchObject({ attackerId: 'a', pressed: true });
      expect(chains.blows[2].attackerId).toBe('b');
   });

   it('a decisive defence (≥2 SL margin) is flagged as seizing the initiative', () => {
      // Attack target 5 (SL 0) into defence 95 (SL 9): margin 9 — every stop
      // is a seize. The flags feed the narration; the swap itself happens on
      // any miss.
      const a = profile('a', { initiative: 9, attackTarget: 5, defenseTarget: 95 });
      const b = profile('b', { attackTarget: 5, defenseTarget: 95 });

      const seizes = resolveDuel(a, b, rngLow);
      expect(seizes.blows.every((blow) => !blow.hit && blow.seized)).toBe(true);

      // Defence 15 (SL 1) still turns the SL-0 swing aside — but a margin of 1
      // is no seize, just a plain hand-over.
      const c = profile('c', { initiative: 9, attackTarget: 5, defenseTarget: 15, damage: { min: 1, max: 1 } });
      const d = profile('d', { attackTarget: 5, defenseTarget: 15, damage: { min: 1, max: 1 } });

      const plain = resolveDuel(c, d, rngLow);
      expect(plain.blows.every((blow) => !blow.seized)).toBe(true);
   });
});

describe('followUpChance (D42)', () => {
   it('rises with how decisively the blow landed — the dominant term', () => {
      expect(followUpChance(0, null, 0)).toBe(15); // base, a glancing hit
      expect(followUpChance(2, null, 0)).toBe(39); // +12 per net SL
      expect(followUpChance(5, null, 0)).toBe(75);
   });

   it('is shifted by the attacking style\'s tempo', () => {
      // Same blow (net SL 2): aggressive presses more, defensive resets.
      expect(followUpChance(2, 'striker', 0)).toBe(54); // aggressive +15
      expect(followUpChance(2, 'grappler', 0)).toBe(39); // control = neutral
      expect(followUpChance(2, 'stonewall', 0)).toBe(24); // defensive −15
   });

   it('decays only mildly per follow-up, so a big net SL sustains a long flurry', () => {
      // A lopsided blow (net SL 8) stays near-certain to chain for many swings —
      // the "cut them down" case: 111 → capped, and only slowly eroding.
      expect(followUpChance(8, null, 0)).toBe(FOLLOW_UP_MAX); // 15+96 → capped 95
      expect(followUpChance(8, null, 8)).toBe(71); // 15+96−40, still very likely
      // A marginal blow (net SL 1) dies fast — even fights stay short.
      expect(followUpChance(1, null, 0)).toBe(27);
      expect(followUpChance(1, null, 3)).toBe(12);
   });

   it('is clamped to [0, FOLLOW_UP_MAX] — never negative, never a certainty', () => {
      expect(followUpChance(0, 'stonewall', 2)).toBe(0); // 15−15−10 → floored
      expect(followUpChance(20, 'striker', 0)).toBe(FOLLOW_UP_MAX); // way over → capped
   });
});
