import { Schema, model, type Model } from 'mongoose';

// A durable, long, interactive activity (turn-based duel, multi-room exploration…).
// The document is BOTH the saved per-step state (so the activity survives a bot
// restart) AND the cross-restart "this character is busy" lock. Short, auto-resolved
// actions (sparring) do NOT use this — they commit atomically (D5 rule 1). See D17.

export type ActivityType = 'duel' | 'exploration'; // extend as activities are built
export type ActivityStatus = 'active' | 'completed' | 'abandoned';

export interface ActivitySessionDoc {
   _id: string; // uuid
   type: ActivityType;
   participantIds: string[]; // character ids locked into this activity (sorted)
   step: number; // monotonic; the optimistic-concurrency guard (idempotent steps)
   status: ActivityStatus;
   // Opaque per-activity state (HP mid-duel, rooms visited…). The activity's own
   // code owns the shape; the durability layer treats it as a blob (D17).
   state: Record<string, unknown>;
   expiresAt: Date; // inactivity deadline; refreshed each step
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
   // TTL index: Mongo deletes the doc once `expiresAt` passes — automatic cleanup
   // of abandoned/idle sessions (timeout ⇒ forfeit, no side effect needed; D17).
   expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, minimize: false });

export const ActivitySession = model('ActivitySession', activitySessionSchema) as unknown as Model<ActivitySessionDoc>;
