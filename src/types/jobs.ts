import type { ToscheClient } from '../client.js';

export interface CronJob {
   name: string;
   /** Standard cron expression, e.g. '0 * * * *' for every full hour. */
   schedule: string;
   run(client: ToscheClient): Promise<void>;
}
