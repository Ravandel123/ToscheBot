import { Schema, model, type Model } from 'mongoose';
import { DEFAULT_ELO } from '../../game/combat/elo.js';

// One record per Character (ELO is per-character — D12). Keyed by Character._id,
// with the character's name denormalized so the leaderboard needs no join.
export interface SmackdownRecordDoc {
   _id: string; // Character._id
   characterName: string;
   eloRating: number;
   wins: number;
   losses: number;
   /** Highest PvE Spire-ladder rung cleared = the next rung to fight (D37).
    *  Absent on pre-D37 records → read as 0. */
   trialRung: number;
   createdAt: Date;
   updatedAt: Date;
}

const smackdownRecordSchema = new Schema({
   _id: { type: String, required: true },
   characterName: { type: String, required: true },
   eloRating: { type: Number, required: true, default: DEFAULT_ELO },
   wins: { type: Number, required: true, default: 0 },
   losses: { type: Number, required: true, default: 0 },
   trialRung: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export const SmackdownRecord = model('SmackdownRecord', smackdownRecordSchema) as unknown as Model<SmackdownRecordDoc>;
