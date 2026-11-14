import { Schema, model, type Model } from 'mongoose';

// One fight record per Character, keyed by Character._id, with the character's
// name denormalized so the leaderboard needs no join. Records written before
// 2026-11 may still carry `eloRating`/`wins`/`losses` from the removed for-fun
// sparring — nothing reads them.
export interface SmackdownRecordDoc {
   _id: string; // Character._id
   characterName: string;
   /** Real, consent-gated duels won / lost. */
   duelWins: number;
   duelLosses: number;
   /** Highest PvE Spire-ladder rung cleared = the next rung to fight. */
   trialRung: number;
   createdAt: Date;
   updatedAt: Date;
}

const smackdownRecordSchema = new Schema({
   _id: { type: String, required: true },
   characterName: { type: String, required: true },
   duelWins: { type: Number, required: true, default: 0 },
   duelLosses: { type: Number, required: true, default: 0 },
   trialRung: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export const SmackdownRecord = model('SmackdownRecord', smackdownRecordSchema) as unknown as Model<SmackdownRecordDoc>;
