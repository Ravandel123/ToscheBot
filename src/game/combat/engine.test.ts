import { afterEach, describe, expect, it, vi } from 'vitest';
import { simulateFight, type Fighter } from './engine.js';
import type { CombatStats } from './stats.js';

afterEach(() => {
   vi.restoreAllMocks();
});

function fighter(id: string, overrides: Partial<CombatStats> = {}): Fighter {
   return {
      id,
      stats: { name: id, maxHp: 20, attackBonus: 0, defenseBonus: 0, strengthBonus: 1, constitutionBonus: 1, ...overrides },
   };
}

describe('simulateFight', () => {
   it('produces a consistent winner/loser and a non-empty round log', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = simulateFight(fighter('a'), fighter('b'));

      expect([result.winnerId, result.loserId].sort()).toEqual(['a', 'b']);
      expect(result.winnerId).not.toBe(result.loserId);
      expect(result.rounds.length).toBeGreaterThan(0);
   });

   it('lets a vastly stronger fighter win', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const strong = fighter('strong', { maxHp: 200, attackBonus: 100, defenseBonus: 100, strengthBonus: 50, constitutionBonus: 50 });
      const weak = fighter('weak', { maxHp: 5, attackBonus: 0, defenseBonus: 0, strengthBonus: 0, constitutionBonus: 0 });

      expect(simulateFight(strong, weak).winnerId).toBe('strong');
   });
});
