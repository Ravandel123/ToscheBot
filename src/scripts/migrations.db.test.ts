import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, runMigrations } from './migrations.js';
import { smackdownService } from '../db/services/smackdownService.js';
import { useTestDb } from '../testing/memoryDb.js';

useTestDb();

describe('migrations', () => {
   it('have unique ids', () => {
      const ids = MIGRATIONS.map((migration) => migration.id);
      expect(new Set(ids).size).toBe(ids.length);
   });

   it('drop the old sparring fields, keep everything else, and rerun as a no-op', async () => {
      const records = mongoose.connection.db!.collection<{ _id: string } & Record<string, unknown>>('smackdownrecords');
      await records.insertMany([
         { _id: 'old', characterName: 'Old', eloRating: 1180, wins: 9, losses: 2, trialRung: 4 },
         { _id: 'new', characterName: 'New', duelWins: 3, duelLosses: 1, trialRung: 0 },
      ]);

      const first = await runMigrations();
      expect(first.modified).toBe(1);

      const old = await records.findOne({ _id: 'old' });
      expect(old).toMatchObject({ characterName: 'Old', trialRung: 4 });
      expect(old).not.toHaveProperty('eloRating');
      expect(old).not.toHaveProperty('wins');
      expect(old).not.toHaveProperty('losses');
      expect(await records.findOne({ _id: 'new' })).toMatchObject({ duelWins: 3, duelLosses: 1 });

      // A migrated pre-existing record still reads and counts normally.
      await smackdownService.recordDuel({ characterId: 'old', characterName: 'Old' }, { characterId: 'new', characterName: 'New' });
      expect((await smackdownService.getLeaderboard('duelWins')).map((record) => record._id)).toEqual(['new', 'old']);

      expect((await runMigrations()).modified).toBe(0);
   });
});
