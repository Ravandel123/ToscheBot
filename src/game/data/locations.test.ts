import { describe, expect, it } from 'vitest';
import { LOCATIONS, locationFeature, type LocationDefinition, type LocationId } from './locations.js';
import { WEATHER } from './weather.js';
import { LOCATION_STATS, type LocationStatKey } from './locationStats.js';

// Content-integrity checks for the D31 world fields (the graph itself is
// enforced in game/world/travel.test.ts): a typo'd weather kind or an
// out-of-range base stat should fail `npm test`, not surface mid-game.

const entries = Object.entries(LOCATIONS) as [LocationId, LocationDefinition][];

describe('LOCATIONS world content', () => {
   it('climate overrides reference real weather kinds with positive weights', () => {
      for (const [id, location] of entries) {
         for (const [kind, weight] of Object.entries(location.climate ?? {})) {
            expect(kind in WEATHER, `${id} climate has unknown weather '${kind}'`).toBe(true);
            expect(weight, `${id} climate weight for ${kind}`).toBeGreaterThan(0);
         }
      }
   });

   it('features carry unique ids and reveal lines', () => {
      for (const [id, location] of entries) {
         const features = location.features ?? [];
         const ids = features.map((feature) => feature.id);
         expect(new Set(ids).size, `${id} has duplicate feature ids`).toBe(ids.length);
         for (const feature of features) {
            expect(feature.name.length, `${id}/${feature.id} name`).toBeGreaterThan(0);
            expect(feature.discoveryLine.length, `${id}/${feature.id} discoveryLine`).toBeGreaterThan(0);
         }
      }
   });

   it('baseStats reference real stats within their catalog ranges', () => {
      for (const [id, location] of entries) {
         for (const [key, value] of Object.entries(location.baseStats ?? {})) {
            expect(key in LOCATION_STATS, `${id} baseStats has unknown stat '${key}'`).toBe(true);
            const def = LOCATION_STATS[key as LocationStatKey];
            expect(value, `${id} ${key} below min`).toBeGreaterThanOrEqual(def.min);
            expect(value, `${id} ${key} above max`).toBeLessThanOrEqual(def.max);
         }
      }
   });
});

describe('locationFeature', () => {
   it('resolves a feature by id and tolerates unknown ids (D10 rule 3)', () => {
      expect(locationFeature('riverbank', 'old_jetty')?.name).toBe('the Old Jetty');
      expect(locationFeature('riverbank', 'no_such_feature')).toBeUndefined();
      expect(locationFeature('atlantis', 'old_jetty')).toBeUndefined(); // falls back to the start (no features)
   });
});
