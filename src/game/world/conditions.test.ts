import { describe, expect, it } from 'vitest';
import { availableHubActions, evaluateCondition, worldContext, type WorldContext } from './conditions.js';
import type { LocationStateDoc } from '../../db/models/locationState.js';

const ctx = (overrides: Partial<WorldContext> = {}): WorldContext => ({
   timeOfDay: 'day',
   weather: 'clear',
   activeEventIds: [],
   discoveredFeatureIds: [],
   ...overrides,
});

describe('evaluateCondition', () => {
   it('accepts when there is no condition', () => {
      expect(evaluateCondition(undefined, ctx())).toEqual({ ok: true });
   });

   it('gates on time of day with a readable reason', () => {
      expect(evaluateCondition({ timeOfDay: ['night'] }, ctx())).toEqual({ ok: false, reason: 'only during the night' });
      expect(evaluateCondition({ timeOfDay: ['morning', 'day'] }, ctx()).ok).toBe(true);
   });

   it('gates on weather', () => {
      expect(evaluateCondition({ weather: ['rain', 'storm'] }, ctx()).ok).toBe(false);
      expect(evaluateCondition({ weather: ['clear'] }, ctx()).ok).toBe(true);
   });

   it('gates on a running location event', () => {
      expect(evaluateCondition({ duringEvent: 'bards_night' }, ctx())).toEqual({ ok: false, reason: 'only during Bards\' Night' });
      expect(evaluateCondition({ duringEvent: 'bards_night' }, ctx({ activeEventIds: ['bards_night'] })).ok).toBe(true);
   });

   it('gates on a discovered feature', () => {
      expect(evaluateCondition({ requiresDiscovery: 'old_jetty' }, ctx()).ok).toBe(false);
      expect(evaluateCondition({ requiresDiscovery: 'old_jetty' }, ctx({ discoveredFeatureIds: ['old_jetty'] })).ok).toBe(true);
   });

   it('gates on minimum traits, counting absent traits as 0', () => {
      expect(evaluateCondition({ minTraits: { empathy: 1 } }, ctx()).ok).toBe(false);
      expect(evaluateCondition({ minTraits: { empathy: 1 } }, ctx({ traits: { empathy: 2 } })).ok).toBe(true);
      expect(evaluateCondition({ minTraits: { empathy: 1 } }, ctx({ traits: { courage: 5 } })).ok).toBe(false);
   });
});

describe('worldContext', () => {
   it('snapshots the location state, tolerating unknown weather kinds (D10 rule 3)', () => {
      const state = {
         weather: { kind: 'blizzard', since: new Date(), until: new Date() },
         events: [{ eventId: 'market_day', startedAt: new Date(), endsAt: new Date() }],
         discoveredFeatureIds: ['old_jetty'],
      } as unknown as LocationStateDoc;

      const built = worldContext(state);
      expect(built.weather).toBe('clear'); // fallback
      expect(built.activeEventIds).toEqual(['market_day']);
      expect(built.discoveredFeatureIds).toEqual(['old_jetty']);
      expect(built.traits).toBeUndefined();
   });
});

describe('availableHubActions', () => {
   it('closes the market outside daylight but keeps it visible with the reason', () => {
      const market = availableHubActions('plaza', ctx({ timeOfDay: 'night' })).find((entry) => entry.action.id === 'market');
      expect(market?.ok).toBe(false);
      expect(market?.reason).toContain('only during');
   });

   it('hides undiscovered secrets entirely and reveals them once found', () => {
      const hidden = availableHubActions('riverbank', ctx());
      expect(hidden.some((entry) => entry.action.id === 'jetty')).toBe(false);

      const revealed = availableHubActions('riverbank', ctx({ discoveredFeatureIds: ['old_jetty'] }));
      expect(revealed.some((entry) => entry.action.id === 'jetty' && entry.ok)).toBe(true);
   });

   it('opens event-gated actions only while the event runs', () => {
      const quiet = availableHubActions('tavern', ctx({ timeOfDay: 'evening' })).find((entry) => entry.action.id === 'listen');
      expect(quiet?.ok).toBe(false);

      const lively = availableHubActions('tavern', ctx({ timeOfDay: 'evening', activeEventIds: ['bards_night'] })).find((entry) => entry.action.id === 'listen');
      expect(lively?.ok).toBe(true);
   });
});
