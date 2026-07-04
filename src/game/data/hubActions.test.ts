import { describe, expect, it } from 'vitest';
import { HUB_ACTIONS, actionsAt, hubAction, type HubAction } from './hubActions.js';
import { LOCATIONS } from './locations.js';

describe('actionsAt', () => {
   it("offers every 'anywhere' action at each location", () => {
      const anywhere = (Object.values(HUB_ACTIONS) as HubAction[]).filter((a) => a.locations === 'anywhere').map((a) => a.id);
      for (const locationId of Object.keys(LOCATIONS)) {
         const here = actionsAt(locationId).map((a) => a.id);
         for (const id of anywhere)
            expect(here, `${id} should be offered at ${locationId}`).toContain(id);
      }
   });

   it('scopes location-bound actions to their locations', () => {
      expect(actionsAt('tavern').map((a) => a.id)).toContain('drink');
      expect(actionsAt('spire').map((a) => a.id)).not.toContain('drink');
   });
});

// Content-integrity check (like the location-graph and encounter tests): a
// typo'd location id would silently hide an action forever — fail `npm test`.
describe('HUB_ACTIONS catalog', () => {
   it('references only real locations', () => {
      for (const [id, action] of Object.entries(HUB_ACTIONS)) {
         if (action.locations === 'anywhere')
            continue;
         for (const locationId of action.locations)
            expect(locationId in LOCATIONS, `${id} targets unknown location '${locationId}'`).toBe(true);
      }
   });

   it('keys each action by its own id and resolves it back', () => {
      for (const [key, action] of Object.entries(HUB_ACTIONS)) {
         expect(action.id).toBe(key);
         expect(hubAction(key)).toBe(action);
      }
      expect(hubAction('no_such_action')).toBeUndefined();
   });
});
