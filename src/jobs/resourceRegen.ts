import type { CronJob } from '../types/jobs.js';
import { characterService } from '../db/services/characterService.js';
import { activitySessionService } from '../db/services/activitySessionService.js';
import { log } from '../lib/log.js';

export default {
   name: 'resource-regen',
   schedule: '0 * * * *', // top of every hour
   async run(client) {
      // Split the world three ways (D7/D23), bulk-first:
      //   free characters        → one full-regen updateMany;
      //   mid-durable-activity   → one busy-tick updateMany (AP always accrues,
      //                            paused vitals are SKIPPED, not deferred);
      //   in-memory-locked       → a deferred single tick that decides
      //                            full-vs-busy when it actually lands.
      const locked = client.locks.lockedIds();
      const busy = await activitySessionService.activeParticipantIds();
      const lockedSet = new Set(locked);

      const modified = await characterService.regenAll([...new Set([...locked, ...busy])]);
      const busyModified = await characterService.regenAllBusy(busy.filter((id) => !lockedSet.has(id)));

      for (const characterId of locked)
         await client.locks.deferOrRun(characterId, () => characterService.regen(characterId));

      log.info(`Resource regen tick: ${modified} full, ${busyModified} busy (AP-only), ${locked.length} deferred.`);
   },
} satisfies CronJob;
