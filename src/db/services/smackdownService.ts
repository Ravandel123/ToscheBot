import { SmackdownRecord, type SmackdownRecordDoc } from '../models/smackdownRecord.js';
import { DEFAULT_ELO, eloChange } from '../../game/combat/elo.js';

export interface Combatant {
   characterId: string;
   characterName: string;
}

export interface EloOutcome {
   change: number;
   winnerRating: number;
   loserRating: number;
}

export const smackdownService = {
   async getOrCreate(characterId: string, characterName: string): Promise<SmackdownRecordDoc> {
      return SmackdownRecord.findOneAndUpdate(
         { _id: characterId },
         { $set: { characterName }, $setOnInsert: { eloRating: DEFAULT_ELO, wins: 0, losses: 0 } },
         { upsert: true, returnDocument: 'after' },
      ).lean<SmackdownRecordDoc>();
   },

   /**
    * Applies one match result: updates both Elo ratings and win/loss tallies.
    * Safe as read-then-write because the caller holds both characters' locks for
    * the whole fight, so no other smackdown write can interleave (D5).
    */
   async recordResult(winner: Combatant, loser: Combatant): Promise<EloOutcome> {
      const [winnerRecord, loserRecord] = await Promise.all([
         this.getOrCreate(winner.characterId, winner.characterName),
         this.getOrCreate(loser.characterId, loser.characterName),
      ]);

      const change = eloChange(winnerRecord.eloRating, loserRecord.eloRating, 1);

      await Promise.all([
         SmackdownRecord.updateOne({ _id: winner.characterId }, { $inc: { eloRating: change, wins: 1 } }),
         SmackdownRecord.updateOne({ _id: loser.characterId }, { $inc: { eloRating: -change, losses: 1 } }),
      ]);

      return {
         change,
         winnerRating: winnerRecord.eloRating + change,
         loserRating: loserRecord.eloRating - change,
      };
   },

   /** Top records ranked by `sortField` (descending). The field comes from the
    *  leaderboard-category catalog (game/combat/leaderboards.ts), so adding a
    *  board is a catalog edit, not a service change. */
   async getLeaderboard(sortField: keyof SmackdownRecordDoc = 'eloRating', limit = 10): Promise<SmackdownRecordDoc[]> {
      return SmackdownRecord.find().sort({ [sortField]: -1 }).limit(limit).lean<SmackdownRecordDoc[]>();
   },

   /** Advances a character's PvE Spire-ladder progress to `rung` (D37). `$max`
    *  makes it monotonic — a replay/double never regresses it. Safe under the
    *  caller's character lock (like recordResult). */
   async advanceTrial(characterId: string, characterName: string, rung: number): Promise<void> {
      await SmackdownRecord.updateOne(
         { _id: characterId },
         { $set: { characterName }, $max: { trialRung: rung }, $setOnInsert: { eloRating: DEFAULT_ELO, wins: 0, losses: 0 } },
         { upsert: true },
      );
   },
};
