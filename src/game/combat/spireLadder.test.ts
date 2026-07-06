import { describe, expect, it } from 'vitest';
import { LADDER_LENGTH, SPIRE_LADDER, championAtRung, championProfile, trialTarget } from './spireLadder.js';

describe('Spire ladder', () => {
   it('is a non-empty ordered gauntlet', () => {
      expect(LADDER_LENGTH).toBe(SPIRE_LADDER.length);
      expect(LADDER_LENGTH).toBeGreaterThanOrEqual(10);
   });

   it('climbs in attack skill and reward from rung to rung', () => {
      for (let i = 1; i < SPIRE_LADDER.length; i++) {
         expect(SPIRE_LADDER[i].stats.attackTarget).toBeGreaterThanOrEqual(SPIRE_LADDER[i - 1].stats.attackTarget);
         expect(SPIRE_LADDER[i].reward.coins).toBeGreaterThan(SPIRE_LADDER[i - 1].reward.coins);
      }
   });

   it('has unique champion ids', () => {
      const ids = SPIRE_LADDER.map((champion) => champion.id);
      expect(new Set(ids).size).toBe(ids.length);
   });

   it('bounds the rung: a champion at each rung, null once cleared', () => {
      expect(championAtRung(0)).not.toBeNull();
      expect(championAtRung(LADDER_LENGTH - 1)).not.toBeNull();
      expect(championAtRung(LADDER_LENGTH)).toBeNull();
      expect(championAtRung(-1)).toBeNull();
   });

   it('builds a full-Health, uuid-safe CombatProfile', () => {
      const profile = championProfile(SPIRE_LADDER[0]);
      expect(profile.health).toBe(profile.maxHealth);
      expect(profile.characterId.startsWith('spire:')).toBe(true);
   });
});

describe('trialTarget', () => {
   const cleared = 3; // beaten rungs 0,1,2; next unbeaten is 3

   it('defaults (no opponent) to the next unbeaten rung — a climb', () => {
      const target = trialTarget(null, cleared);
      expect(target).toEqual({ kind: 'climb', rung: 3, champion: SPIRE_LADDER[3] });
   });

   it('picking the next unbeaten champion is also a climb', () => {
      expect(trialTarget(SPIRE_LADDER[3].id, cleared).kind).toBe('climb');
   });

   it('picking an already-beaten champion is a rematch (no reward)', () => {
      const target = trialTarget(SPIRE_LADDER[1].id, cleared);
      expect(target).toMatchObject({ kind: 'rematch', rung: 1 });
   });

   it('picking a champion beyond your progress is locked', () => {
      expect(trialTarget(SPIRE_LADDER[5].id, cleared).kind).toBe('locked');
   });

   it('reports cleared when nothing is left and no opponent is named', () => {
      expect(trialTarget(null, LADDER_LENGTH).kind).toBe('cleared');
   });

   it('falls back to the climb for an unknown champion id', () => {
      expect(trialTarget('nonexistent', cleared).kind).toBe('climb');
   });
});
