import obstacle from './obstacle.js';
import type { ActivityHandler } from '../../../types/activities.js';

// The activity-handler registry (D22): ActivitySession.type → handler. Add a
// new interactive activity by dropping a handler file in this (loader-invisible)
// folder and listing it here — the `activity` component router and every
// re-entry point (e.g. `/travel` telling you you're busy) pick it up.
const HANDLER_LIST: readonly ActivityHandler[] = [obstacle];

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
