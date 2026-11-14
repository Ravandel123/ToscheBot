import type { ToscheClient } from '../client.js';

export interface CronJob {
   name: string;
   /** Standard cron expression, e.g. '0 * * * *' for every full hour. */
   schedule: string;
   /** Also run once when the bot comes online (for jobs that make up missed
    *  ticks). The job itself must make that extra run idempotent. */
   runOnStart?: boolean;
   run(client: ToscheClient): Promise<void>;
}
