import { describe, expect, it } from 'vitest';
import { smackdownService } from './smackdownService.js';
import { SmackdownRecord } from '../models/smackdownRecord.js';
import { DEFAULT_ELO, eloChange } from '../../game/combat/elo.js';
import { useTestDb } from '../../testing/memoryDb.js';

// Only a real Mongo proves the pieces a hand-mock can't: the upsert defaults,
// the symmetric $inc on both records, the DYNAMIC sortField leaderboard, and —
// the important one — the `$max`-guarded trialRung that must never regress on a
// replay/double (D37).
useTestDb();

describe('smackdownService.getOrCreate', () => {
   it('inserts with the default Elo and zeroed tallies', async () => {
      const record = await smackdownService.getOrCreate('char-1', 'Fenwick');

      expect(record.eloRating).toBe(DEFAULT_ELO);
      expect(record.wins).toBe(0);
      expect(record.losses).toBe(0);
      expect(record.trialRung).toBe(0);
      expect(record.characterName).toBe('Fenwick');
   });

   it('refreshes the denormalized name without resetting an existing rating', async () => {
      await smackdownService.getOrCreate('char-1', 'Fenwick');
      await SmackdownRecord.updateOne({ _id: 'char-1' }, { $set: { eloRating: 1234, wins: 7 } });

      const record = await smackdownService.getOrCreate('char-1', 'Fenwick the Renamed');

      // $setOnInsert only fires on insert, so the second call keeps the rating.
      expect(record.eloRating).toBe(1234);
      expect(record.wins).toBe(7);
      expect(record.characterName).toBe('Fenwick the Renamed');
   });
});

describe('smackdownService.recordResult', () => {
   it('moves Elo symmetrically and tallies the win/loss on both records', async () => {
      const outcome = await smackdownService.recordResult(
         { characterId: 'winner', characterName: 'Winner' },
         { characterId: 'loser', characterName: 'Loser' },
      );

      // Equal starting ratings → the K/2 swing, applied +/- to each side.
      const change = eloChange(DEFAULT_ELO, DEFAULT_ELO, 1);
      expect(outcome).toEqual({
         change,
         winnerRating: DEFAULT_ELO + change,
         loserRating: DEFAULT_ELO - change,
      });

      const winner = await SmackdownRecord.findById('winner').lean();
      const loser = await SmackdownRecord.findById('loser').lean();
      expect(winner).toMatchObject({ eloRating: DEFAULT_ELO + change, wins: 1, losses: 0 });
      expect(loser).toMatchObject({ eloRating: DEFAULT_ELO - change, wins: 0, losses: 1 });
   });

   it('accumulates across successive bouts', async () => {
      await smackdownService.recordResult(
         { characterId: 'a', characterName: 'A' },
         { characterId: 'b', characterName: 'B' },
      );
      await smackdownService.recordResult(
         { characterId: 'a', characterName: 'A' },
         { characterId: 'b', characterName: 'B' },
      );

      const a = await SmackdownRecord.findById('a').lean();
      expect(a?.wins).toBe(2);
      expect(a?.losses).toBe(0);
      // Winning again against a now lower-rated B yields a smaller second gain.
      expect(a!.eloRating).toBeGreaterThan(DEFAULT_ELO);
   });
});

describe('smackdownService.advanceTrial', () => {
   it('upserts a record and sets the cleared rung', async () => {
      await smackdownService.advanceTrial('climber', 'Climber', 3);

      const record = await SmackdownRecord.findById('climber').lean();
      expect(record).toMatchObject({ trialRung: 3, eloRating: DEFAULT_ELO, wins: 0, losses: 0 });
   });

   it('is monotonic — a lower rung (replay/double) never regresses progress', async () => {
      await smackdownService.advanceTrial('climber', 'Climber', 3);
      await smackdownService.advanceTrial('climber', 'Climber', 1);

      const record = await SmackdownRecord.findById('climber').lean();
      expect(record?.trialRung).toBe(3);

      await smackdownService.advanceTrial('climber', 'Climber', 5);
      expect((await SmackdownRecord.findById('climber').lean())?.trialRung).toBe(5);
   });
});

describe('smackdownService.getLeaderboard', () => {
   it('ranks by the requested field, descending, honoring the limit', async () => {
      await SmackdownRecord.create([
         { _id: 'low', characterName: 'Low', eloRating: 900, wins: 9 },
         { _id: 'mid', characterName: 'Mid', eloRating: 1100, wins: 1 },
         { _id: 'high', characterName: 'High', eloRating: 1300, wins: 5 },
      ]);

      const byElo = await smackdownService.getLeaderboard('eloRating', 10);
      expect(byElo.map((r) => r._id)).toEqual(['high', 'mid', 'low']);

      // The dynamic sortField is the whole point: the SAME data ranks differently
      // for the "Most Victories" board (D36).
      const byWins = await smackdownService.getLeaderboard('wins', 2);
      expect(byWins.map((r) => r._id)).toEqual(['low', 'high']);
   });
});
