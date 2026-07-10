// In-game places (not Discord channels, though a location MAY map to one via
// `channelId`). Characters store a `locationId`; the `/play` hub walks the
// `connectedTo` graph (D21/D30) and the NPC-movement cron (Phase 6C) will too.
// PLACEHOLDER set — expand when the world is designed. The graph is treated as
// UNDIRECTED: every edge must be listed on both ends (validated by test).
//
// The catalog is the STATIC half of the world (D10/D31): what a place is, its
// roads, climate bias, discoverable features and starting stats. The DYNAMIC
// half (current weather, running events, what has been discovered, live stats,
// visits) lives in the LocationState collection — and WHO is standing here is
// neither: presence derives from Character.locationId (indexed), the single
// source of truth.

import type { WeatherId } from './weather.js';
import type { LocationStatKey } from './locationStats.js';
import type { ResourceNodeId } from './resourceNodes.js';

export interface LocationFeature {
   /** Stable slug, unique within its location; stored in LocationState.discoveredFeatureIds. */
   id: string;
   name: string;
   /** In-character line shown to the discoverer (and echoed by the chronicle). */
   discoveryLine: string;
}

export interface LocationDefinition {
   name: string;
   description: string;
   /** Ids of adjacent locations (the travel/movement graph). */
   connectedTo: readonly string[];
   /** Optional Discord channel (id or name) tied to this place. */
   channelId?: string;
   /** Weather-weight overrides for this place (missing kinds use each kind's defaultWeight). */
   climate?: Partial<Record<WeatherId, number>>;
   /** Discoverable points of interest — hidden until somebody finds them (D31). */
   features?: readonly LocationFeature[];
   /** Starting values for dynamic location stats (missing keys use catalog defaults). */
   baseStats?: Partial<Record<LocationStatKey, number>>;
   /** What can be gathered here (R16) — ids into the resource-node catalog,
    *  test-validated like graph edges. Absent = nothing grows/bites here. */
   resourceNodes?: readonly ResourceNodeId[];
}

export const LOCATIONS = {
   spire: {
      name: 'The Spire of Deltrada',
      description: 'The Imperator\'s seat.',
      connectedTo: ['plaza'],
      baseStats: { danger: 0, prosperity: 70 },
   },
   plaza: {
      name: 'Deltrada Plaza',
      description: 'The bustling heart of the city.',
      connectedTo: ['spire', 'tavern', 'riverbank'],
      baseStats: { danger: 5, prosperity: 80 },
   },
   tavern: {
      name: 'The Sunken Tankard',
      description: 'Where soldiers drink and boast.',
      connectedTo: ['plaza'],
      baseStats: { danger: 10, prosperity: 60 },
   },
   riverbank: {
      name: 'The Riverbank',
      description: 'A quiet bend of the river outside the walls.',
      connectedTo: ['plaza', 'tanglewood'],
      climate: { clear: 4, fog: 3, rain: 3 },
      features: [
         {
            id: 'old_jetty',
            name: 'the Old Jetty',
            discoveryLine: 'Half-swallowed by the river, rotted pilings trace an old jetty no map remembers.',
         },
      ],
      baseStats: { danger: 20, prosperity: 30 },
      resourceNodes: ['riverbank_greens'],
   },
   tanglewood: {
      name: 'The Tanglewood',
      description: 'Old growth crowding the path beyond the river; the canopy swallows the light.',
      connectedTo: ['riverbank'],
      climate: { overcast: 4, fog: 3, clear: 2 },
      baseStats: { danger: 30, prosperity: 15 },
      resourceNodes: ['woodland_undergrowth'],
   },
} as const satisfies Record<string, LocationDefinition>;

export type LocationId = keyof typeof LOCATIONS;

export const STARTING_LOCATION: LocationId = 'spire';

/** Resolves a stored location id, falling back to the starting location (D10 rule 3). */
export function resolveLocationId(id: string): LocationId {
   return id in LOCATIONS ? (id as LocationId) : STARTING_LOCATION;
}

/** Resolves a stored location id to its display name (same fallback). */
export function locationName(id: string): string {
   return LOCATIONS[resolveLocationId(id)].name;
}

/** A location's feature by id, if it exists (unknown ids resolve to undefined — D10 rule 3).
 *  Widened off the `as const` union so optional fields type-check. */
export function locationFeature(locationId: string, featureId: string): LocationFeature | undefined {
   const location: LocationDefinition = LOCATIONS[resolveLocationId(locationId)];
   return location.features?.find((feature) => feature.id === featureId);
}
