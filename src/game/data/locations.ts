// In-game places (not Discord channels, though a location MAY map to one via
// `channelId`). Characters store a `locationId`; the NPC-movement cron (Phase 6C)
// will walk NPCs along `connectedTo`. PLACEHOLDER set — expand when the world is
// designed.

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
   plaza: { name: 'Deltrada Plaza', description: 'The bustling heart of the city.', connectedTo: ['spire', 'tavern'] },
   tavern: { name: 'The Sunken Tankard', description: 'Where soldiers drink and boast.', connectedTo: ['plaza'] },
} as const satisfies Record<string, LocationDefinition>;

export type LocationId = keyof typeof LOCATIONS;

export const STARTING_LOCATION: LocationId = 'spire';

/** Resolves a stored location id, falling back to the starting location (D10 rule 3). */
export function locationName(id: string): string {
   return (LOCATIONS as Record<string, LocationDefinition>)[id]?.name ?? LOCATIONS[STARTING_LOCATION].name;
}
