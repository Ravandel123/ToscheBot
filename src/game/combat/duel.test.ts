import { describe, expect, it } from 'vitest';
import { MAX_ROUNDS, resolveDuel, type CombatProfile, type Rng } from './duel.js';

// Always rolls the LOW end of any range: d100 → 1 (a strong percentile success),
// damage → its minimum. Deterministic, so an outcome is fully scripted by the
// profiles' targets rather than the dice.
const rngLow: Rng = (min) => min;

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

   it('hamper (Grappler): a connecting hold fouls the foe\'s next swing', () => {
      // Grappler A always connects; B would also always connect (95 vs low
      // defence) — but hampered, B's attack drops by 15 for the swing after
      // every hold. Both roll 1, so the margin math shows up in B's damage.
      const grappler = profile('a', {
         initiative: 9,
         attackTarget: 95,
         defenseTarget: 5,
         plan: { style: 'grappler', rules: [] },
         styleTargets: { grappler: { attack: 95, defense: 5 } },
         maxHealth: 100,
         health: 100,
      });
      const foe = profile('b', { attackTarget: 95, defenseTarget: 5, maxHealth: 100, health: 100 });

      const result = resolveDuel(grappler, foe, rngLow);
      const foeSwings = result.blows.filter((blow) => blow.attackerId === 'b');

      // Every foe swing follows a connecting hold → all hampered.
      expect(foeSwings.length).toBeGreaterThan(0);
      expect(foeSwings.every((blow) => blow.hampered)).toBe(true);
      // Hampered attack 95−15=80 → SL 8 on a roll of 1, vs A's defence 5 →
      // SL 0: net 8 (an unfouled swing would net 9). Damage = 3 + net 8.
      expect(foeSwings[0].damage).toBe(3 + 8);
   });

   it('riposte (Stonewall): a defence won by a wide margin counters, and can down', () => {
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
