import challenge from './challenge.js';
import dialogue from './dialogue.js';
import type { ActivityHandler } from '../../../types/activities.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';

// The activity-handler registry (D22): ActivitySession.type → handler. Add a
// new interactive activity by dropping a handler file in this (loader-invisible)
// folder and listing it here — the `activity` component router and every
// re-entry point (e.g. `/play` telling you you're busy) pick it up.
const HANDLER_LIST: readonly ActivityHandler[] = [challenge, dialogue];

function buildRegistry(): ReadonlyMap<string, ActivityHandler> {
   const registry = new Map<string, ActivityHandler>();

   for (const handler of HANDLER_LIST) {
      // Fail fast at load, like duplicate command names/namespaces.
      if (registry.has(handler.type))
         throw new Error(`Duplicate activity handler for type '${handler.type}'.`);

      registry.set(handler.type, handler);
   }

   return registry;
}

export const activityHandlers = buildRegistry();

/** The handler owning a session type, or undefined for a type with no handler
 *  (an old session after a rename — callers degrade gracefully, D10 rule 3). */
export function activityHandler(type: string): ActivityHandler | undefined {
   return activityHandlers.get(type);
}

/** What a session's character is in the middle of; a retired type still reads. */
export function activityTitle(session: ActivitySessionDoc): string {
   return activityHandler(session.type)?.title(session) ?? `an unfinished ${session.type}`;
}

/** The line shown when a busy character tries to do something else — it names
 *  the unfinished activity (sessions never expire, so the player must know
 *  what is holding the character). */
export function busyNote(session: ActivitySessionDoc): string {
   return `⚠️ Unfinished business — **${activityTitle(session)}**. Deal with it first.`;
}
