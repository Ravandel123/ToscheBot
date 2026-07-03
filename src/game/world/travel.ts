import { LOCATIONS, resolveLocationId, type LocationId } from '../data/locations.js';

// Pure travel rules (D21) — no Discord, no DB. The `/travel` command and the
// future NPC-movement cron (6C) both walk the same graph through these helpers.

// PLACEHOLDER (D14): travel is free until the ruleset prices actions. The
// spend path is already wired through `spendActionPoints`, so setting a real
// cost (flat or per-edge) later changes only this value/shape.
export const TRAVEL_AP_COST = 0;

export type TravelBlockReason = 'unknown-destination' | 'same-location' | 'not-connected';

export type TravelCheck =
   | { ok: true; from: LocationId; to: LocationId }
   | { ok: false; reason: TravelBlockReason; from: LocationId };

/** The locations reachable in one step from a (stored, possibly stale) location id. */
export function connectionsFrom(id: string): LocationId[] {
   return [...LOCATIONS[resolveLocationId(id)].connectedTo] as LocationId[];
}

/** Validates one travel move along the graph. Stale `from` ids fall back to the start (D10 rule 3). */
export function checkTravel(fromRaw: string, toRaw: string): TravelCheck {
   const from = resolveLocationId(fromRaw);

   if (!(toRaw in LOCATIONS))
      return { ok: false, reason: 'unknown-destination', from };

   const to = toRaw as LocationId;
   if (to === from)
      return { ok: false, reason: 'same-location', from };
   if (!connectionsFrom(from).includes(to))
      return { ok: false, reason: 'not-connected', from };

   return { ok: true, from, to };
}
