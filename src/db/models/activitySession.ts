import { Schema, model, type Model } from 'mongoose';

// A durable, long, interactive activity (a travel challenge, a conversation…).
// The document is BOTH the saved per-step state (so the activity survives a bot
// restart) AND the cross-restart "this character is busy" lock. Short, auto-resolved
// actions (a duel, a gather roll) do NOT use this — they commit atomically
// under the character lock. A session never expires on its own: it ends when the
// player finishes it, takes its exit, or the owner clears it (`h!session`).

export type ActivityType = 'duel' | 'exploration' | 'challenge' | 'dialogue'; // extend as activities are built
export type ActivityStatus = 'active' | 'completed' | 'abandoned';

export interface ActivitySessionDoc {
   _id: string; // uuid
   type: ActivityType;
   participantIds: string[]; // character ids locked into this activity (sorted)
   step: number; // monotonic; the optimistic-concurrency guard (idempotent steps)
   status: ActivityStatus;
   // Opaque per-activity state (HP mid-duel, rooms visited…). The activity's own
   // code owns the shape; the durability layer treats it as a blob.
   state: Record<string, unknown>;
   createdAt: Date;
   updatedAt: Date;
}

const activitySessionSchema = new Schema({
   _id: { type: String, required: true },
   type: { type: String, required: true },
   participantIds: { type: [String], required: true, index: true },
   step: { type: Number, required: true, default: 0 },
   status: { type: String, required: true, default: 'active' },
   state: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false });

export const ActivitySession = model('ActivitySession', activitySessionSchema) as unknown as Model<ActivitySessionDoc>;
