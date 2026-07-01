import { ActivityType } from 'discord.js';
import { defineEvent } from '../types/events.js';
import { startJobs } from '../core/scheduler.js';
import { log } from '../lib/log.js';

export default defineEvent({
   name: 'clientReady',
   once: true,
   execute(client, readyClient) {
      readyClient.user.setPresence({
         activities: [{ name: 'Total War: Dunia, Deluxe Edition', type: ActivityType.Playing }],
      });

      startJobs(client, client.jobs);

      log.info(`Logged in as ${readyClient.user.tag}.`);
   },
});
