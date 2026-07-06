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
      defenseTarget: 40,
      damage: { min: 3, max: 3 },
      damageType: 'impact',
      strengthBonus: 0,
      soak: 0,
      initiative: 5,
      stance: 'balanced',
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
