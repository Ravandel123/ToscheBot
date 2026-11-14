import { SmackdownRecord, type SmackdownRecordDoc } from '../models/smackdownRecord.js';

export interface Combatant {
   characterId: string;
   characterName: string;
}

/** The record fields a leaderboard can rank by. */
export type LeaderboardField = 'duelWins' | 'trialRung';

// Upsert defaults for the counters an update does not itself touch — a field
// may not appear in both `$setOnInsert` and `$inc`/`$max` of one update.
const ZERO = { duelWins: 0, duelLosses: 0, trialRung: 0 } as const;

function insertDefaults(...touched: (keyof typeof ZERO)[]): Partial<typeof ZERO> {
   const defaults: Partial<Record<keyof typeof ZERO, 0>> = { ...ZERO };
   for (const key of touched)
      delete defaults[key];
   return defaults;
}

export const smackdownService = {
   async getOrCreate(characterId: string, characterName: string): Promise<SmackdownRecordDoc> {
      return SmackdownRecord.findOneAndUpdate(
         { _id: characterId },
         { $set: { characterName }, $setOnInsert: insertDefaults() },
         { upsert: true, returnDocument: 'after' },
      ).lean<SmackdownRecordDoc>();
   },

   /** Tallies one real duel on both records. Two atomic upserts — no read. */
   async recordDuel(winner: Combatant, loser: Combatant): Promise<void> {
      await Promise.all([
         SmackdownRecord.updateOne(
            { _id: winner.characterId },
            { $set: { characterName: winner.characterName }, $inc: { duelWins: 1 }, $setOnInsert: insertDefaults('duelWins') },
            { upsert: true },
         ),
         SmackdownRecord.updateOne(
            { _id: loser.characterId },
            { $set: { characterName: loser.characterName }, $inc: { duelLosses: 1 }, $setOnInsert: insertDefaults('duelLosses') },
            { upsert: true },
         ),
      ]);
   },

   /** Top records by `field` (descending). Records with nothing in that field
    *  are left out, so a ladder-only climber is not listed among duelists. */
   async getLeaderboard(field: LeaderboardField, limit = 10): Promise<SmackdownRecordDoc[]> {
      return SmackdownRecord.find({ [field]: { $gt: 0 } }).sort({ [field]: -1 }).limit(limit).lean<SmackdownRecordDoc[]>();
   },

   /** Advances a character's Spire-ladder progress to `rung`. `$max` makes it
    *  monotonic — a replay or double click never regresses it. */
   async advanceTrial(characterId: string, characterName: string, rung: number): Promise<void> {
      await SmackdownRecord.updateOne(
         { _id: characterId },
         { $set: { characterName }, $max: { trialRung: rung }, $setOnInsert: insertDefaults('trialRung') },
         { upsert: true },
      );
   },
};
