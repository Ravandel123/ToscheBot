import { randomUUID } from 'node:crypto';
import { ActivitySession, type ActivitySessionDoc, type ActivityType } from '../models/activitySession.js';
import { isExpired, nextExpiry } from '../../game/activity/session.js';

// The activity-agnostic durability layer (D17). Specific activities (duel,
// exploration) own the `state` shape and the game logic; this service only knows
// how to persist steps crash-safely and reap idle sessions. No mechanics here —
// it's the seam the Phase 7 ruleset / 6C travel will build on.
export const activitySessionService = {
   /** Opens a new active session for the (sorted) participants. */
   async create(type: ActivityType, participantIds: string[], initialState: Record<string, unknown> = {}, ttlMs?: number): Promise<ActivitySessionDoc> {
      const session = {
         _id: randomUUID(),
         type,
         participantIds: [...participantIds].sort(),
         step: 0,
         status: 'active' as const,
         state: initialState,
         expiresAt: nextExpiry(ttlMs),
      };

      const created = await ActivitySession.create(session);
      return created.toObject();
   },

   async get(id: string): Promise<ActivitySessionDoc | null> {
      return ActivitySession.findById(id).lean<ActivitySessionDoc>();
   },

   /** The active, non-expired session a character is locked into — the cross-restart "busy" check. */
   async getActiveForParticipant(characterId: string): Promise<ActivitySessionDoc | null> {
      const session = await ActivitySession.findOne({ participantIds: characterId, status: 'active' }).lean<ActivitySessionDoc>();

      // Lazily treat a lapsed session as gone (the TTL index will delete it shortly).
      return session && !isExpired(session.expiresAt) ? session : null;
   },

   /** Every character id busy in ANY active, non-expired session — the durable
    *  busy set the regen job splits on (D23). One round trip. */
   async activeParticipantIds(): Promise<string[]> {
      const ids: unknown[] = await ActivitySession.distinct('participantIds', { status: 'active', expiresAt: { $gt: new Date() } });
      return ids.filter((id): id is string => typeof id === 'string');
   },

   /**
    * Advances one step IFF the session is still at `expectedStep` and active —
    * optimistic concurrency that makes a step idempotent against double-clicks and
    * crash-replay (D6/D17). Returns the updated doc, or null if the guard failed
    * (someone/something already advanced it; the duplicate is safely ignored).
    */
   async advance(id: string, expectedStep: number, state: Record<string, unknown>, ttlMs?: number): Promise<ActivitySessionDoc | null> {
      return ActivitySession.findOneAndUpdate(
         { _id: id, step: expectedStep, status: 'active' },
         { $set: { state, expiresAt: nextExpiry(ttlMs) }, $inc: { step: 1 } },
         { new: true },
      ).lean<ActivitySessionDoc>();
   },

   /** Ends a session cleanly — the caller has already committed the outcome to the character(s). */
   async complete(id: string): Promise<void> {
      await ActivitySession.deleteOne({ _id: id });
   },

   /** Abandons a session — the caller applies any AP refund first, per the chosen policy (D17). */
   async abandon(id: string): Promise<void> {
      await ActivitySession.deleteOne({ _id: id });
   },
};
