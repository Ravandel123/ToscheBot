// In-game places (not Discord channels, though a location MAY map to one via
// `channelId`). Characters store a `locationId`; `/travel` walks the
// `connectedTo` graph (D21) and the NPC-movement cron (Phase 6C) will too.
// PLACEHOLDER set — expand when the world is designed. The graph is treated as
// UNDIRECTED: every edge must be listed on both ends (validated by test).

export interface LocationDefinition {
   name: string;
   description: string;
   /** Ids of adjacent locations (the travel/movement graph). */
   connectedTo: readonly string[];
   /** Optional Discord channel (id or name) tied to this place. */
   channelId?: string;
}

export const LOCATIONS = {
   spire: { name: 'The Spire of Deltrada', description: 'The Imperator\'s seat.', connectedTo: ['plaza'] },
   plaza: { name: 'Deltrada Plaza', description: 'The bustling heart of the city.', connectedTo: ['spire', 'tavern', 'riverbank'] },
   tavern: { name: 'The Sunken Tankard', description: 'Where soldiers drink and boast.', connectedTo: ['plaza'] },
   riverbank: { name: 'The Riverbank', description: 'A quiet bend of the river outside the walls.', connectedTo: ['plaza'] },
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
