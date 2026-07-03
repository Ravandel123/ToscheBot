import { describe, expect, it } from 'vitest';
import { LOCATIONS, STARTING_LOCATION, type LocationId } from '../data/locations.js';
import { checkTravel, connectionsFrom } from './travel.js';

const ids = Object.keys(LOCATIONS) as LocationId[];

// The catalog is data, but the graph has invariants code relies on (D21):
// dangling or one-way edges would strand characters, so the deploy gate
// (npm test) enforces them instead of trusting future edits.
describe('location graph', () => {
   it('every edge points at an existing location', () => {
      for (const id of ids)
         for (const target of LOCATIONS[id].connectedTo)
            expect(target in LOCATIONS, `${id} → ${target}`).toBe(true);
   });

   it('is undirected: every edge is listed on both ends', () => {
      for (const id of ids)
         for (const target of LOCATIONS[id].connectedTo)
            expect(LOCATIONS[target].connectedTo, `${target} → ${id}`).toContain(id);
   });

   it('has no self-loops', () => {
      for (const id of ids)
         expect(LOCATIONS[id].connectedTo).not.toContain(id);
   });
});

describe('connectionsFrom', () => {
   it('lists the neighbors of a location', () => {
      expect(connectionsFrom('plaza')).toEqual(expect.arrayContaining(['spire', 'tavern']));
   });

   it('falls back to the starting location for a stale stored id (D10 rule 3)', () => {
      expect(connectionsFrom('renamed_place')).toEqual(connectionsFrom(STARTING_LOCATION));
   });
});

describe('checkTravel', () => {
   it('allows a move along an edge', () => {
      expect(checkTravel('plaza', 'tavern')).toEqual({ ok: true, from: 'plaza', to: 'tavern' });
   });

   it('rejects an unknown destination', () => {
      expect(checkTravel('plaza', 'atlantis')).toEqual({ ok: false, reason: 'unknown-destination', from: 'plaza' });
   });

   it('rejects staying in place', () => {
      expect(checkTravel('plaza', 'plaza')).toEqual({ ok: false, reason: 'same-location', from: 'plaza' });
   });

   it('rejects a move with no connecting road', () => {
      expect(checkTravel('spire', 'tavern')).toEqual({ ok: false, reason: 'not-connected', from: 'spire' });
   });

   it('resolves a stale origin to the start before validating', () => {
      const fallbackNeighbor = LOCATIONS[STARTING_LOCATION].connectedTo[0];
      expect(checkTravel('renamed_place', fallbackNeighbor)).toEqual({ ok: true, from: STARTING_LOCATION, to: fallbackNeighbor });
   });
});
