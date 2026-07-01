import { schedule, validate } from 'node-cron';
import type { ToscheClient } from '../client.js';
import { CronJob } from '../types/jobs.js';
import { log } from '../lib/log.js';

/** Called from ToscheClient.init() so a bad expression kills startup, not the ready event. */
export function validateJobs(jobs: CronJob[]): void {
   for (const job of jobs) {
      if (!validate(job.schedule))
         throw new Error(`Job '${job.name}' has an invalid cron expression: '${job.schedule}'`);
   }
}

export function startJobs(client: ToscheClient, jobs: CronJob[]): void {
   for (const job of jobs) {
      schedule(job.schedule, () => {
         job.run(client).catch((error: unknown) => {
            log.error(`Cron job '${job.name}' failed:`, error);
         });
      });

      log.info(`Scheduled job '${job.name}' (${job.schedule}).`);
   }
}
