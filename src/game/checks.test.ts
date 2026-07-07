import { describe, expect, it } from 'vitest';
import { CHECK_MAX_TARGET, CHECK_MIN_TARGET, checkEffective, checkTarget, checkTrainingWeight, rollAgainst, type CheckSubject } from './checks.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from './data/attributes.js';
import type { SkillNodeId } from './data/skills.js';
import type { RaceId } from './data/races.js';

function subject(o: {
   race?: RaceId | null;
   agility?: number;
   points?: Partial<Record<SkillNodeId, number>>;
} = {}): CheckSubject {
   const attributes = Object.fromEntries(
      ATTRIBUTE_KEYS.map((k) => [k, k === 'agility' ? (o.agility ?? 30) : 30]),
   ) as Record<AttributeKey, number>;
   const skills = Object.fromEntries(
      Object.entries(o.points ?? {}).map(([id, p]) => [id, { points: p, progress: 0 }]),
   );

   return { identity: { race: o.race ?? null }, attributes, progression: { skills } };
}

describe('checkTarget', () => {
   it('uses the whole attribute for an untrained (bare-attribute) check', () => {
      expect(checkTarget(subject(), { attribute: 'agility' })).toBe(30);
   });

   it('weights a bare attribute when asked', () => {
      expect(checkTarget(subject({ agility: 40 }), { attribute: 'agility', attributeWeight: 0.5 })).toBe(20);
   });

   it('sums a skill node: attribute blend + trained path points', () => {
      // swimming's blend is agility×1 (30); its path is athletics → swimming.
      expect(checkTarget(subject(), { node: 'swimming' })).toBe(30);
      expect(checkTarget(subject({ points: { swimming: 8 } }), { node: 'swimming' })).toBe(38);
      expect(checkTarget(subject({ points: { athletics: 5, swimming: 8 } }), { node: 'swimming' })).toBe(43);
   });

   it('applies the difficulty modifier', () => {
      expect(checkTarget(subject(), { node: 'swimming', modifier: -10 })).toBe(20);
      expect(checkTarget(subject(), { attribute: 'agility', modifier: 20 })).toBe(50);
   });

   it('multiplies the chance for a race with an affinity (the lutren swimmer)', () => {
      const check = { node: 'swimming', raceAffinity: { lutren: 1.5 } } as const;
      expect(checkTarget(subject({ race: 'lutren' }), check)).toBe(Math.round(30 * 1.5));
      expect(checkTarget(subject({ race: 'canid' }), check)).toBe(30); // no affinity, no boost
      expect(checkTarget(subject(), check)).toBe(30); // raceless
   });

   it('clamps so nothing is impossible or guaranteed', () => {
      expect(checkTarget(subject({ agility: 10 }), { attribute: 'agility', modifier: -30 })).toBe(CHECK_MIN_TARGET);
      expect(checkTarget(subject({ agility: 90 }), { attribute: 'agility', modifier: 40 })).toBe(CHECK_MAX_TARGET);
   });
});

describe('checkEffective', () => {
   it('is uncapped (surplus is Mastery / crafting quality) while the target clamps', () => {
      const master = subject({ points: { smithing: 20, weaponsmithing: 30, bladesmithing: 60 } });
      const effective = checkEffective(master, { node: 'bladesmithing' });
      expect(effective).toBeGreaterThan(100);
      expect(checkTarget(master, { node: 'bladesmithing' })).toBe(CHECK_MAX_TARGET); // 95, clamped
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

describe('checkTrainingWeight (D40)', () => {
   it('treats a coin-flip as the 1.0 baseline', () => {
      expect(checkTrainingWeight(50)).toBe(1);
   });

   it('rewards long shots and near-ignores sure things', () => {
      expect(checkTrainingWeight(25)).toBe(1.5);
      expect(checkTrainingWeight(CHECK_MIN_TARGET)).toBeCloseTo(1.9);
      expect(checkTrainingWeight(CHECK_MAX_TARGET)).toBeCloseTo(0.1);
   });
});
