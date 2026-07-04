import { Schema, model, type Model } from 'mongoose';

// Dynamic, per-location world state (D31). The static catalog (game/data/
// locations.ts) says what a place IS; this collection says what is HAPPENING
// there right now: current weather spell, running events, discovered secrets,
// mood stats, footfall. Docs are keyed by the location id and created lazily
// on first read (locationStateService.getFresh) — no seeding step.
//
// WHO is standing at a location is deliberately NOT stored here: presence
// derives from Character.locationId (indexed), the single source of truth —
// duplicating it would mean two writes per move and drift under concurrency.

export interface ActiveLocationEvent {
   eventId: string; // → LocationEventId, resolved with a fallback at read time
   startedAt: Date;
   endsAt: Date;
}

export interface LocationStateDoc {
   _id: string; // → LocationId
   /** The current weather spell; re-rolled lazily once `until` passes. */
   weather: { kind: string; since: Date; until: Date };
   /** Events running here right now; lapsed ones are swept on read. */
   events: ActiveLocationEvent[];
   // Features found so far. Server-wide on purpose: one character's discovery
   // unlocks the place for everyone (it feeds the chronicle, not a private map).
   discoveredFeatureIds: string[];
   // Dynamic stats keyed by LOCATION_STATS (danger, prosperity…). Plain object:
   // ADDING A STAT = one catalog entry, no migration (missing keys fall back
   // through statValue).
   stats: Record<string, number>;
   /** Total arrivals — flavor/titles fodder ("the most trodden square in Deltrada"). */
   visits: number;
   createdAt: Date;
   updatedAt: Date;
}

const activeEventSchema = new Schema({
   eventId: { type: String, required: true },
   startedAt: { type: Date, required: true },
   endsAt: { type: Date, required: true },
}, { _id: false });

const locationStateSchema = new Schema({
   _id: { type: String, required: true },
   weather: {
      kind: { type: String, required: true },
      since: { type: Date, required: true },
      until: { type: Date, required: true },
   },
   events: { type: [activeEventSchema], default: [] },
   discoveredFeatureIds: { type: [String], default: [] },
   stats: { type: Schema.Types.Mixed, default: {} },
   visits: { type: Number, required: true, default: 0 },
}, { timestamps: true, minimize: false });

export const LocationState = model('LocationState', locationStateSchema) as unknown as Model<LocationStateDoc>;
