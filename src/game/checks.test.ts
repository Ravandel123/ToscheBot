import { describe, expect, it } from 'vitest';
import { CHECK_MAX_TARGET, CHECK_MIN_TARGET, SKILL_CHECK_BONUS_PER_LEVEL, checkTarget, rollAgainst, type CheckSubject } from './checks.js';
import type { RaceId } from './data/races.js';

function subject(overrides: { race?: RaceId | null; agility?: number; swimmingLevel?: number } = {}): CheckSubject {
   return {
      identity: { race: overrides.race ?? null },
      attributes: { agility: overrides.agility ?? 30 },
      skills: { swimming: { level: overrides.swimmingLevel ?? 1, progress: 0 } },
   } as unknown as CheckSubject;
}

describe('checkTarget', () => {
   it('uses the governing attribute alone for a raw check', () => {
      expect(checkTarget(subject(), { attribute: 'agility' })).toBe(30);
   });

   it('adds the placeholder skill bonus per level', () => {
      expect(checkTarget(subject({ swimmingLevel: 2 }), { attribute: 'agility', skill: 'swimming' }))
         .toBe(30 + 2 * SKILL_CHECK_BONUS_PER_LEVEL);
   });

   it('applies the difficulty modifier', () => {
      expect(checkTarget(subject(), { attribute: 'agility', modifier: -10 })).toBe(20);
      expect(checkTarget(subject(), { attribute: 'agility', modifier: 20 })).toBe(50);
   });

   it('multiplies the chance for a race with an affinity (the lutren swimmer)', () => {
      const check = { attribute: 'agility', skill: 'swimming', raceAffinity: { lutren: 1.5 } } as const;
      expect(checkTarget(subject({ race: 'lutren' }), check)).toBe(Math.round((30 + 5) * 1.5));
      expect(checkTarget(subject({ race: 'canid' }), check)).toBe(35); // no affinity, no boost
      expect(checkTarget(subject(), check)).toBe(35); // raceless
   });

   it('clamps so nothing is impossible or guaranteed', () => {
      expect(checkTarget(subject({ agility: 10 }), { attribute: 'agility', modifier: -30 })).toBe(CHECK_MIN_TARGET);
      expect(checkTarget(subject({ agility: 90 }), { attribute: 'agility', modifier: 40 })).toBe(CHECK_MAX_TARGET);
   });
});

describe('rollAgainst', () => {
   it('succeeds on a roll at or under the target', () => {
      expect(rollAgainst(45, 45).success).toBe(true);
      expect(rollAgainst(45, 46).success).toBe(false);
   });

   it('computes Success Levels as the tens difference (RPG/ R1)', () => {
      expect(rollAgainst(55, 23).successLevels).toBe(3); // clean success
      expect(rollAgainst(55, 54).successLevels).toBe(0); // bare success
      expect(rollAgainst(55, 71).successLevels).toBe(-2); // failure margin
   });

   it('rolls its own d100 when none is injected', () => {
      const result = rollAgainst(50);
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(100);
      expect(result.success).toBe(result.roll <= 50);
   });
});
