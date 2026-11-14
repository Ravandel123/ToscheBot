import { describe, expect, it } from 'vitest';
import { smackdownService } from './smackdownService.js';
import { SmackdownRecord } from '../models/smackdownRecord.js';
import { useTestDb } from '../../testing/memoryDb.js';

// Only a real Mongo proves the pieces a hand-mock can't: the upsert defaults
// (a field may not sit in both $setOnInsert and $inc/$max), the tallies on both
// records, the dynamic leaderboard field, and the `$max`-guarded trialRung that
// must never regress on a replay.
useTestDb();

describe('smackdownService.getOrCreate', () => {
   it('inserts with zeroed tallies', async () => {
      const record = await smackdownService.getOrCreate('char-1', 'Fenwick');

      expect(record).toMatchObject({ characterName: 'Fenwick', duelWins: 0, duelLosses: 0, trialRung: 0 });
   });

   it('refreshes the denormalized name without resetting existing tallies', async () => {
      await smackdownService.getOrCreate('char-1', 'Fenwick');
      await SmackdownRecord.updateOne({ _id: 'char-1' }, { $set: { duelWins: 7 } });

      const record = await smackdownService.getOrCreate('char-1', 'Fenwick the Renamed');

      expect(record.duelWins).toBe(7);
      expect(record.characterName).toBe('Fenwick the Renamed');
   });
});

describe('smackdownService.recordDuel', () => {
   it('creates both records with complete defaults and tallies the result', async () => {
      await smackdownService.recordDuel(
         { characterId: 'winner', characterName: 'Winner' },
         { characterId: 'loser', characterName: 'Loser' },
      );

      expect(await SmackdownRecord.findById('winner').lean()).toMatchObject({ duelWins: 1, duelLosses: 0, trialRung: 0 });
      expect(await SmackdownRecord.findById('loser').lean()).toMatchObject({ duelWins: 0, duelLosses: 1, trialRung: 0 });
   });

   it('accumulates across bouts and leaves ladder progress alone', async () => {
      await smackdownService.advanceTrial('a', 'A', 4);
      for (let i = 0; i < 2; i++)
         await smackdownService.recordDuel(
            { characterId: 'a', characterName: 'A' },
            { characterId: 'b', characterName: 'B' },
         );

      expect(await SmackdownRecord.findById('a').lean()).toMatchObject({ duelWins: 2, duelLosses: 0, trialRung: 4 });
      expect(await SmackdownRecord.findById('b').lean()).toMatchObject({ duelWins: 0, duelLosses: 2 });
   });
});

describe('smackdownService.advanceTrial', () => {
   it('upserts a record and sets the cleared rung', async () => {
      await smackdownService.advanceTrial('climber', 'Climber', 3);

      expect(await SmackdownRecord.findById('climber').lean()).toMatchObject({ trialRung: 3, duelWins: 0, duelLosses: 0 });
   });

   it('is monotonic — a lower rung (replay/double) never regresses progress', async () => {
      await smackdownService.advanceTrial('climber', 'Climber', 3);
      await smackdownService.advanceTrial('climber', 'Climber', 1);
      expect((await SmackdownRecord.findById('climber').lean())?.trialRung).toBe(3);

      await smackdownService.advanceTrial('climber', 'Climber', 5);
      expect((await SmackdownRecord.findById('climber').lean())?.trialRung).toBe(5);
   });
});

describe('smackdownService.getLeaderboard', () => {
   it('ranks by the requested field, honors the limit, and omits empty rows', async () => {
      await SmackdownRecord.create([
         { _id: 'duelist', characterName: 'Duelist', duelWins: 9, trialRung: 1 },
         { _id: 'climber', characterName: 'Climber', duelWins: 0, trialRung: 8 },
         { _id: 'both', characterName: 'Both', duelWins: 5, trialRung: 3 },
      ]);

      const byDuels = await smackdownService.getLeaderboard('duelWins', 10);
      expect(byDuels.map((r) => r._id)).toEqual(['duelist', 'both']);

      const byRung = await smackdownService.getLeaderboard('trialRung', 2);
      expect(byRung.map((r) => r._id)).toEqual(['climber', 'both']);
   });
});
