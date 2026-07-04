import { LocationState, type LocationStateDoc } from '../models/locationState.js';
import { rollWeather } from '../../game/data/weather.js';
import { LOCATION_STATS, initialStats, type LocationStatKey } from '../../game/data/locationStats.js';

// Dynamic world state per location (D31). Every write is an atomic single-doc,
// filter-guarded update — concurrent hub opens and arrivals (even one player's
// three stale panels) race safely: one writer wins the guard, the rest re-read.
// No location locks: nothing here ever spans more than one document, and none
// of it sits inside a character's critical section invariants.

const PIPELINE = { updatePipeline: true } as const;

export const locationStateService = {
   /**
    * The location's current state, created lazily and freshened on read: an
    * expired weather spell is re-rolled and lapsed events are swept. Callers
    * that later write (discoverFeature, tryStartEvent…) can rely on the doc
    * existing because every flow reads it first.
    */
   async getFresh(locationId: string): Promise<LocationStateDoc> {
      const now = new Date();
      let doc = await LocationState.findOneAndUpdate(
         { _id: locationId },
         {
            $setOnInsert: {
               weather: rollWeather(locationId, now),
               events: [],
               discoveredFeatureIds: [],
               stats: initialStats(locationId),
               visits: 0,
            },
         },
         { upsert: true, returnDocument: 'after' },
      ).lean<LocationStateDoc>();

      if (!doc)
         throw new Error(`Location state upsert returned nothing for '${locationId}'.`);

      // Weather lapsed → roll the next spell. Filter-guarded: of N concurrent
      // readers exactly one rolls; the losers just take the winner's spell.
      if (new Date(doc.weather.until).getTime() <= now.getTime()) {
         const rolled = await LocationState.findOneAndUpdate(
            { _id: locationId, 'weather.until': { $lte: now } },
            { $set: { weather: rollWeather(locationId, now) } },
            { returnDocument: 'after' },
         ).lean<LocationStateDoc>();

         doc = rolled ?? await LocationState.findById(locationId).lean<LocationStateDoc>() ?? doc;
      }

      // Sweep ended events (the $pull matches exactly what we filter locally,
      // so the returned doc and the stored one agree without a re-read).
      if (doc.events.some((event) => new Date(event.endsAt).getTime() <= now.getTime())) {
         await LocationState.updateOne({ _id: locationId }, { $pull: { events: { endsAt: { $lte: now } } } });
         doc = { ...doc, events: doc.events.filter((event) => new Date(event.endsAt).getTime() > now.getTime()) };
      }

      return doc;
   },

   /** Starts an event unless it is already running. True = this call started it
    *  (the caller announces it); false = a concurrent arrival beat us to it. */
   async tryStartEvent(locationId: string, eventId: string, startedAt: Date, endsAt: Date): Promise<boolean> {
      const result = await LocationState.updateOne(
         { _id: locationId, 'events.eventId': { $ne: eventId } },
         { $push: { events: { eventId, startedAt, endsAt } } },
      );

      return result.modifiedCount > 0;
   },

   /** Marks a feature discovered. True = newly found (announce it, chronicle it);
    *  false = somebody already knew. Idempotent by construction ($addToSet). */
   async discoverFeature(locationId: string, featureId: string): Promise<boolean> {
      const result = await LocationState.updateOne(
         { _id: locationId },
         { $addToSet: { discoveredFeatureIds: featureId } },
      );

      return result.modifiedCount > 0;
   },

   /** Nudges one dynamic stat, clamped to its catalog range — the write seam
    *  for events and encounter outcomes (🟡 no consumer writes yet, D31). */
   async adjustStat(locationId: string, key: LocationStatKey, delta: number): Promise<void> {
      const { min, max } = LOCATION_STATS[key];
      const fallback = initialStats(locationId)[key];

      await LocationState.updateOne(
         { _id: locationId },
         [{
            $set: {
               [`stats.${key}`]: {
                  $max: [min, { $min: [max, { $add: [{ $ifNull: [`$stats.${key}`, fallback] }, delta] }] }],
               },
            },
         }],
         PIPELINE,
      );
   },

   /** Counts one arrival. Flavor counter — a crash-replay double-count is accepted. */
   async recordVisit(locationId: string): Promise<void> {
      await LocationState.updateOne({ _id: locationId }, { $inc: { visits: 1 } });
   },
};
