import { describe, expect, it } from 'vitest';
import { jobStateService } from './jobStateService.js';
import { characterService } from './characterService.js';
import { Character } from '../models/character.js';
import { useTestDb } from '../../testing/memoryDb.js';

useTestDb();

const at = (iso: string): Date => new Date(iso);

describe('jobStateService.claimHours', () => {
   it('starts the clock on the first call and owes nothing', async () => {
      expect(await jobStateService.claimHours('job', 168, at('2026-11-11T10:30:00Z'))).toBe(0);
   });

   it('owes one hour per clock hour crossed, and nothing twice inside an hour', async () => {
      await jobStateService.claimHours('job', 168, at('2026-11-11T10:30:00Z'));

      expect(await jobStateService.claimHours('job', 168, at('2026-11-11T11:00:00Z'))).toBe(1);
      expect(await jobStateService.claimHours('job', 168, at('2026-11-11T11:20:00Z'))).toBe(0);
      // Offline 11:30 → 14:10: the 12:00, 13:00 and 14:00 ticks were missed.
      expect(await jobStateService.claimHours('job', 168, at('2026-11-11T14:10:00Z'))).toBe(3);
      expect(await jobStateService.claimHours('job', 168, at('2026-11-11T14:59:00Z'))).toBe(0);
   });

   it('caps a long outage and still moves the clock to now', async () => {
      await jobStateService.claimHours('job', 24, at('2026-11-01T00:00:00Z'));

      expect(await jobStateService.claimHours('job', 24, at('2026-11-11T00:00:00Z'))).toBe(24);
      expect(await jobStateService.claimHours('job', 24, at('2026-11-11T00:30:00Z'))).toBe(0);
   });

   it('keeps separate clocks per job', async () => {
      await jobStateService.claimHours('a', 168, at('2026-11-11T10:00:00Z'));
      await jobStateService.claimHours('b', 168, at('2026-11-11T12:00:00Z'));

      expect(await jobStateService.claimHours('a', 168, at('2026-11-11T13:00:00Z'))).toBe(3);
      expect(await jobStateService.claimHours('b', 168, at('2026-11-11T13:00:00Z'))).toBe(1);
   });
});

describe('characterService.regenAll with several hours', () => {
   it('pays AP for every hour and clamps vitals at max', async () => {
      const character = await characterService.create('owner-1', { name: 'Tester', race: 'canid' });
      await Character.updateOne({ _id: character._id }, { $set: { 'resources.health.current': 1, 'actionPoints.current': 0 } });

      await characterService.regenAll([], 3);
      const afterThree = (await characterService.get(character._id))!;
      expect(afterThree.actionPoints.current).toBe(3);
      expect(afterThree.resources.health.current).toBe(1 + 3 * 2);

      await characterService.regenAll([], 100);
      const afterMany = (await characterService.get(character._id))!;
      expect(afterMany.actionPoints.current).toBe(103);
      expect(afterMany.resources.health.current).toBe(afterMany.resources.health.max);
   });
});
