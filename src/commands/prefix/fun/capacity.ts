import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { capacityPhrase } from '../../../fun/measurements.js';

export default {
   name: 'capacity',
   aliases: ['volume'],
   description: 'Tosch gauges the capacity of anything.',
   usage: 'capacity [of what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, capacityPhrase());
   },
} satisfies PrefixCommand;
