import type { CronJob } from '../types/jobs.js';
import { characterService } from '../db/services/characterService.js';
import { activitySessionService } from '../db/services/activitySessionService.js';
import { jobStateService } from '../db/services/jobStateService.js';
import { log } from '../lib/log.js';

// Longest outage that is made up in full. 🟡 A week of regen in one lump is
// generous; anything longer is treated as a week.
const MAX_CATCH_UP_HOURS = 168;

// Hourly vitals + Action Points. Bulk-first (D7): one atomic updateMany for
// every free character, one for the mid-activity ones (AP only — vitals pause
// while busy, D23), then a deferred single update per character whose lock is
// held right now.
//
// The job also runs once at startup. It asks how many clock hours it has not
// yet accounted for and pays them all at once — so hours the bot spent offline
// are not lost, and a restart inside an hour (or a double-fired cron) pays
// nothing twice.
export default {
   name: 'resource-regen',
   schedule: '0 * * * *', // top of every hour
   runOnStart: true,
   async run(client) {
      const hours = await jobStateService.claimHours('resource-regen', MAX_CATCH_UP_HOURS);
      if (hours === 0)
         return;

      const locked = client.locks.lockedIds();
      const busy = await activitySessionService.activeParticipantIds();
      const lockedSet = new Set(locked);

      const modified = await characterService.regenAll([...new Set([...locked, ...busy])], hours);
      const busyModified = await characterService.regenAllBusy(busy.filter((id) => !lockedSet.has(id)), hours);

      for (const characterId of locked)
         await client.locks.deferOrRun(characterId, () => characterService.regen(characterId, hours));

      log.info(`Resource regen: ${hours} hour(s) — ${modified} full, ${busyModified} busy (AP-only), ${locked.length} deferred.`);
   },
} satisfies CronJob;
