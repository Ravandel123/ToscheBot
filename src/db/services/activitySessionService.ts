import { randomUUID } from 'node:crypto';
import { ActivitySession, type ActivitySessionDoc, type ActivityType } from '../models/activitySession.js';

// The activity-agnostic durability layer (D17). Specific activities (duel,
// exploration) own the `state` shape and the game logic; this service only knows
// how to persist steps crash-safely. Sessions never expire (D58). No mechanics here.
export const activitySessionService = {
   /** Opens a new active session for the (sorted) participants. */
   async create(type: ActivityType, participantIds: string[], initialState: Record<string, unknown> = {}): Promise<ActivitySessionDoc> {
      const session = {
         _id: randomUUID(),
         type,
         participantIds: [...participantIds].sort(),
         step: 0,
         status: 'active' as const,
         state: initialState,
      };

      const created = await ActivitySession.create(session);
      return created.toObject();
   },

   async get(id: string): Promise<ActivitySessionDoc | null> {
      return ActivitySession.findById(id).lean<ActivitySessionDoc>();
   },

   /** The active session a character is locked into — the cross-restart "busy" check. */
   async getActiveForParticipant(characterId: string): Promise<ActivitySessionDoc | null> {
      return ActivitySession.findOne({ participantIds: characterId, status: 'active' }).lean<ActivitySessionDoc>();
   },

   /** Every character id busy in ANY active session — the durable busy set the
    *  regen job splits on (D23). One round trip. */
   async activeParticipantIds(): Promise<string[]> {
      const ids: unknown[] = await ActivitySession.distinct('participantIds', { status: 'active' });
      return ids.filter((id): id is string => typeof id === 'string');
   },

   /** Every active session, oldest first — the owner's `h!session` overview. */
   async listActive(): Promise<ActivitySessionDoc[]> {
      return ActivitySession.find({ status: 'active' }).sort({ createdAt: 1 }).lean<ActivitySessionDoc[]>();
   },

   /**
    * Advances one step IFF the session is still at `expectedStep` and active —
    * optimistic concurrency that makes a step idempotent against double-clicks and
    * crash-replay (D6/D17). Returns the updated doc, or null if the guard failed
    * (someone/something already advanced it; the duplicate is safely ignored).
    */
   async advance(id: string, expectedStep: number, state: Record<string, unknown>): Promise<ActivitySessionDoc | null> {
      return ActivitySession.findOneAndUpdate(
         { _id: id, step: expectedStep, status: 'active' },
         { $set: { state }, $inc: { step: 1 } },
         { returnDocument: 'after' },
      ).lean<ActivitySessionDoc>();
   },

   /** Ends a session cleanly — the caller has already committed the outcome to the character(s). */
   async complete(id: string): Promise<void> {
      await ActivitySession.deleteOne({ _id: id });
   },

   /** Ends a session by its exit (or the owner's `h!session`). Returns whether
    *  THIS call removed it — the caller applies the exit's consequences only on
    *  true, so a double-click cannot charge them twice. */
   async abandon(id: string): Promise<boolean> {
      const result = await ActivitySession.deleteOne({ _id: id, status: 'active' });
      return result.deletedCount === 1;
   },
};
