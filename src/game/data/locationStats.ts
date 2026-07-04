import { LOCATIONS, resolveLocationId } from './locations.js';

// Dynamic location stats catalog (D31): numeric meters a place carries in its
// LocationState doc (danger, prosperity…). ADDING A STAT = one entry here (+
// optionally per-location starting values in locations.ts `baseStats`) — no
// migration: missing keys on stored docs fall back through `statValue`.
// Consumers today: danger biases the travel-encounter chance, both stats color
// the /play hub. `locationStateService.adjustStat` is the write seam for
// events/encounter outcomes (🟡 balance deltas wait for Phase 7).

export interface LocationStatDefinition {
   name: string;
   emoji: string;
   min: number;
   max: number;
   /** Starting value when a location doesn't override it in `baseStats`. */
   defaultValue: number;
   /** Flavor words along the min→max range, shown on the hub (picked by position). */
   bands: readonly [string, ...string[]];
}

export const LOCATION_STATS = {
   danger: {
      name: 'Danger',
      emoji: '⚔️',
      min: 0,
      max: 100,
      defaultValue: 0,
      bands: ['calm', 'uneasy', 'dangerous', 'perilous'],
   },
   prosperity: {
      name: 'Prosperity',
      emoji: '🪙',
      min: 0,
      max: 100,
      defaultValue: 50,
      bands: ['destitute', 'struggling', 'modest', 'thriving', 'opulent'],
   },
} as const satisfies Record<string, LocationStatDefinition>;

export type LocationStatKey = keyof typeof LOCATION_STATS;

export const LOCATION_STAT_KEYS = Object.keys(LOCATION_STATS) as LocationStatKey[];

function clampStat(key: LocationStatKey, value: number): number {
   const def = LOCATION_STATS[key];
   return Math.max(def.min, Math.min(def.max, value));
}

/** The starting stat block for a location (catalog defaults + its `baseStats`). */
export function initialStats(locationId: string): Record<LocationStatKey, number> {
   const base = LOCATIONS[resolveLocationId(locationId)].baseStats;

   return Object.fromEntries(
      LOCATION_STAT_KEYS.map((key) => [key, clampStat(key, base?.[key] ?? LOCATION_STATS[key].defaultValue)]),
   ) as Record<LocationStatKey, number>;
}

/** Reads a stat off a stored (possibly older-shaped) stats blob, falling back
 *  to the location's starting value for keys added since (D10 rule 3). */
export function statValue(locationId: string, stats: Record<string, number> | undefined, key: LocationStatKey): number {
   const stored = stats?.[key];
   if (typeof stored === 'number' && Number.isFinite(stored))
      return clampStat(key, stored);

   return initialStats(locationId)[key];
}

/** The flavor word for a stat value ("calm", "thriving"…), by band position. */
export function statBand(key: LocationStatKey, value: number): string {
   const def = LOCATION_STATS[key];
   const position = (clampStat(key, value) - def.min) / (def.max - def.min + 1);

   return def.bands[Math.min(def.bands.length - 1, Math.floor(position * def.bands.length))];
}
