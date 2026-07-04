import type { LocationCondition } from '../world/conditions.js';

// Location-event catalog (D31): transient happenings that switch ON at a place
// for a few hours (market day, bards' night…). The catalog is the static half;
// which events are RUNNING right now lives in LocationState.events. Events are
// rolled on qualifying arrivals (game/world/events.ts) and expire on their
// `endsAt`. While active they banner the /play hub and can gate hub actions
// (`availability.duringEvent`) or encounters (`conditions.duringEvent`).
// ADDING AN EVENT = one entry here; ids are stable slugs (D10) — they are
// stored in LocationState docs.

export interface LocationEventDefinition {
   name: string;
   emoji: string;
   /** In-character line shown on the hub while the event runs. */
   banner: string;
   /** Location ids where this can happen, or 'anywhere'. */
   locations: readonly string[] | 'anywhere';
   /** Extra requirements for the event to start (evaluated on arrival). */
   conditions?: LocationCondition;
   /** Chance (percent) the event starts on one qualifying arrival. 🟡 tunable. */
   startChancePercent: number;
   /** How long it runs once started (whole hours). 🟡 tunable. */
   durationHours: { min: number; max: number };
}

export const LOCATION_EVENTS = {
   market_day: {
      name: 'Market Day',
      emoji: '🎪',
      banner: 'Traders shout over one another — half of Deltrada is out haggling.',
      locations: ['plaza'],
      conditions: { timeOfDay: ['morning', 'day'] },
      startChancePercent: 20,
      durationHours: { min: 3, max: 6 },
   },
   bards_night: {
      name: 'Bards\' Night',
      emoji: '🎻',
      banner: 'A traveling troupe has claimed the corner table — songs, lies and spilled ale.',
      locations: ['tavern'],
      conditions: { timeOfDay: ['evening', 'night'] },
      startChancePercent: 25,
      durationHours: { min: 2, max: 4 },
   },
   garrison_drill: {
      name: 'Garrison Drill',
      emoji: '🛡️',
      banner: 'The yard rings with drill commands — the garrison is out in force.',
      locations: ['spire'],
      conditions: { timeOfDay: ['morning', 'day'] },
      startChancePercent: 20,
      durationHours: { min: 2, max: 3 },
   },
} as const satisfies Record<string, LocationEventDefinition>;

export type LocationEventId = keyof typeof LOCATION_EVENTS;

/** Resolves a stored event id, tolerating unknown/retired ids (D10 rule 3). */
export function locationEvent(id: string): LocationEventDefinition | undefined {
   return LOCATION_EVENTS[id as LocationEventId];
}
