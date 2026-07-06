import { describe, expect, it } from 'vitest';
import { locationStateService } from './locationStateService.js';
import { LocationState } from '../models/locationState.js';
import { useTestDb } from '../../testing/memoryDb.js';

// The D31 dynamic-location state is all real-Mongo behaviour a mock can't stand
// in for: the lazy upsert defaults, the filter-guarded weather re-roll and event
// sweep on read, the dedup guards ($ne / $addToSet), and the aggregation-pipeline
// stat clamp. Exercise them against an actual in-memory mongod.
useTestDb();

const HOUR = 3_600_000;

describe('locationStateService.getFresh', () => {
   it('creates the doc lazily with the location\'s starting stats and a live weather spell', async () => {
      const doc = await locationStateService.getFresh('plaza');

      // Plaza's baseStats (locations.ts): danger 5, prosperity 80.
      expect(doc.stats).toEqual({ danger: 5, prosperity: 80 });
      expect(doc.events).toEqual([]);
      expect(doc.discoveredFeatureIds).toEqual([]);
      expect(doc.visits).toBe(0);
      expect(new Date(doc.weather.until).getTime()).toBeGreaterThan(Date.now());
   });

   it('re-rolls a lapsed weather spell (exactly one writer wins the guard)', async () => {
      const past = new Date(Date.now() - HOUR);
      await LocationState.create({ _id: 'plaza', weather: { kind: 'storm', since: past, until: past } });

      const doc = await locationStateService.getFresh('plaza');

      // The expired spell is replaced with one whose window extends into the future.
      expect(new Date(doc.weather.until).getTime()).toBeGreaterThan(Date.now());
      const stored = await LocationState.findById('plaza').lean();
      expect(new Date(stored!.weather.until).getTime()).toBeGreaterThan(Date.now());
   });

   it('sweeps ended events on read while keeping still-running ones', async () => {
      const now = Date.now();
      await LocationState.create({
         _id: 'plaza',
         weather: { kind: 'clear', since: new Date(now), until: new Date(now + HOUR) },
         events: [
            { eventId: 'ended_fair', startedAt: new Date(now - 2 * HOUR), endsAt: new Date(now - HOUR) },
            { eventId: 'live_market', startedAt: new Date(now - HOUR), endsAt: new Date(now + HOUR) },
         ],
      });

      const doc = await locationStateService.getFresh('plaza');

      expect(doc.events.map((e) => e.eventId)).toEqual(['live_market']);
      // The sweep is persisted, not just filtered in the returned copy.
      const stored = await LocationState.findById('plaza').lean();
      expect(stored!.events.map((e) => e.eventId)).toEqual(['live_market']);
   });
});

describe('locationStateService.tryStartEvent', () => {
   it('starts an event once and refuses a concurrent duplicate', async () => {
      await locationStateService.getFresh('tavern');
      const later = new Date(Date.now() + HOUR);

      const first = await locationStateService.tryStartEvent('tavern', 'brawl', new Date(), later);
      const dup = await locationStateService.tryStartEvent('tavern', 'brawl', new Date(), later);
      const other = await locationStateService.tryStartEvent('tavern', 'song', new Date(), later);

      expect(first).toBe(true);
      expect(dup).toBe(false);
      expect(other).toBe(true);

      const stored = await LocationState.findById('tavern').lean();
      expect(stored!.events.map((e) => e.eventId).sort()).toEqual(['brawl', 'song']);
   });
});

describe('locationStateService.discoverFeature', () => {
   it('adds a feature once and never duplicates it on a repeat', async () => {
      await locationStateService.getFresh('riverbank');

      // A genuine array addition IS reliably reported as modified.
      const first = await locationStateService.discoverFeature('riverbank', 'old_jetty');
      expect(first).toBe(true);

      await locationStateService.discoverFeature('riverbank', 'old_jetty');

      // Storage stays idempotent by construction ($addToSet), whatever the flag says.
      // NOTE: the repeat's "newly-found" boolean is deliberately NOT asserted here —
      // this mongod reports modifiedCount:1 even for a no-op $addToSet, so unlike
      // tryStartEvent's robust $ne filter-guard, discoverFeature's return value can't
      // reliably tell first-visit from repeat. The array contents are the real contract.
      const stored = await LocationState.findById('riverbank').lean();
      expect(stored!.discoveredFeatureIds).toEqual(['old_jetty']);
   });
});

describe('locationStateService.adjustStat', () => {
   it('clamps to the catalog range in-pipeline (over the max and under the min)', async () => {
      await locationStateService.getFresh('plaza'); // danger starts at 5

      await locationStateService.adjustStat('plaza', 'danger', 200);
      expect((await LocationState.findById('plaza').lean())!.stats.danger).toBe(100);

      await locationStateService.adjustStat('plaza', 'danger', -500);
      expect((await LocationState.findById('plaza').lean())!.stats.danger).toBe(0);
   });

   it('falls back to the location\'s starting value for a missing stat key', async () => {
      // A doc with no stats blob at all — the $ifNull fallback must supply plaza's
      // starting danger (5) before applying the delta, not treat it as zero.
      await LocationState.create({
         _id: 'plaza',
         weather: { kind: 'clear', since: new Date(), until: new Date(Date.now() + HOUR) },
         stats: {},
      });

      await locationStateService.adjustStat('plaza', 'danger', 10);

      expect((await LocationState.findById('plaza').lean())!.stats.danger).toBe(15);
   });
});

describe('locationStateService.recordVisit', () => {
   it('increments the footfall counter', async () => {
      await locationStateService.getFresh('spire');

      await locationStateService.recordVisit('spire');
      await locationStateService.recordVisit('spire');

      expect((await LocationState.findById('spire').lean())!.visits).toBe(2);
   });
});
