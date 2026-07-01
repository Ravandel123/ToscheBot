import { CronJob } from '../types/jobs.js';
import { characterService } from '../db/services/characterService.js';
import { log } from '../lib/log.js';

export default {
   name: 'resource-regen',
   schedule: '0 * * * *', // top of every hour
   async run(client) {
      // Bulk-regen every character not mid-activity, then defer an equivalent
      // single-character tick for each locked one so nothing is lost (D7).
      const locked = client.locks.lockedIds();
      const modified = await characterService.regenAll(locked);

      for (const characterId of locked)
         await client.locks.deferOrRun(characterId, () => characterService.regen(characterId));

      log.info(`Resource regen tick: ${modified} bulk-updated, ${locked.length} deferred.`);
   },
} satisfies CronJob;
