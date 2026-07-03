import { describe, expect, it } from 'vitest';
import { regenFields } from './characterService.js';
import { RESOURCES } from '../../game/data/resources.js';

// Only the pure tick-shape logic is tested (the D23 busy/free split); the
// surrounding service methods are DB glue and stay untested by policy.
describe('regenFields', () => {
   it('full scope regens AP and every regenerating resource', () => {
      const fields = regenFields('full');

      expect(fields).toHaveProperty(['actionPoints.current']);
      for (const [key, def] of Object.entries(RESOURCES))
         if (def.regenPerHour > 0)
            expect(fields).toHaveProperty([`resources.${key}.current`]);
   });

   it('busy scope still accrues AP (D15: time owned is time earned)', () => {
      const fields = regenFields('busy');

      expect(fields).toHaveProperty(['actionPoints.current']);
      expect(fields).toHaveProperty(['actionPoints.totalEarned']);
   });

   it('busy scope pauses every vital not flagged regenWhileBusy', () => {
      const fields = regenFields('busy');

      for (const [key, def] of Object.entries(RESOURCES)) {
         if (def.regenPerHour <= 0)
            continue;

         if (def.regenWhileBusy)
            expect(fields).toHaveProperty([`resources.${key}.current`]);
         else
            expect(fields).not.toHaveProperty([`resources.${key}.current`]);
      }
   });
});
