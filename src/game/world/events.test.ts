import { afterEach, describe, expect, it, vi } from 'vitest';
import { rollEventStart, startableEvents } from './events.js';
import { LOCATION_EVENTS, type LocationEventDefinition } from '../data/locationEvents.js';
import { LOCATIONS } from '../data/locations.js';
import type { WorldContext } from './conditions.js';

afterEach(() => {
   vi.restoreAllMocks();
});

const ctx = (overrides: Partial<WorldContext> = {}): WorldContext => ({
   timeOfDay: 'day',
   weather: 'clear',
   activeEventIds: [],
   discoveredFeatureIds: [],
   ...overrides,
});

// Content-integrity checks (like the location-graph and encounter tests): a
// typo'd location id or a zero-hour duration should fail `npm test`.
describe('LOCATION_EVENTS catalog', () => {
   const entries = Object.entries(LOCATION_EVENTS) as [string, LocationEventDefinition][];

   it('references only real locations', () => {
      for (const [id, event] of entries) {
         if (event.locations === 'anywhere')
            continue;
         for (const locationId of event.locations)
            expect(locationId in LOCATIONS, `${id} targets unknown location '${locationId}'`).toBe(true);
      }
   });

   it('has sane durations and start chances', () => {
      for (const [id, event] of entries) {
         expect(event.durationHours.min, `${id} duration min`).toBeGreaterThanOrEqual(1);
         expect(event.durationHours.max, `${id} duration ordering`).toBeGreaterThanOrEqual(event.durationHours.min);
         expect(event.startChancePercent, `${id} chance`).toBeGreaterThan(0);
         expect(event.startChancePercent, `${id} chance`).toBeLessThanOrEqual(100);
      }
   });
});

describe('startableEvents', () => {
   it('offers an event only at its locations and under its conditions', () => {
      expect(startableEvents('tavern', ctx({ timeOfDay: 'evening' })).map(([id]) => id)).toContain('bards_night');
      expect(startableEvents('tavern', ctx({ timeOfDay: 'day' })).map(([id]) => id)).not.toContain('bards_night');
      expect(startableEvents('plaza', ctx({ timeOfDay: 'evening' })).map(([id]) => id)).not.toContain('bards_night');
   });

   it('skips events already running', () => {
      const pool = startableEvents('tavern', ctx({ timeOfDay: 'evening', activeEventIds: ['bards_night'] }));
      expect(pool.map(([id]) => id)).not.toContain('bards_night');
   });
});

describe('rollEventStart', () => {
   it('returns null when every start chance misses', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);
      expect(rollEventStart('tavern', ctx({ timeOfDay: 'evening' }))).toBeNull();
   });

   it('starts a startable event with a duration inside its catalog range', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // chance hits; min duration
      const now = new Date(0);
      const rolled = rollEventStart('tavern', ctx({ timeOfDay: 'evening' }), now);

      expect(rolled).not.toBeNull();
      expect(rolled!.event).toBe(LOCATION_EVENTS[rolled!.id]);
      expect(rolled!.startedAt).toBe(now);

      const hours = (rolled!.endsAt.getTime() - rolled!.startedAt.getTime()) / 3_600_000;
      expect(hours).toBeGreaterThanOrEqual(rolled!.event.durationHours.min);
      expect(hours).toBeLessThanOrEqual(rolled!.event.durationHours.max);
   });
});
