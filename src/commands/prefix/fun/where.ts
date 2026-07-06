import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { wherePhrase } from '../../../fun/measurements.js';

export default {
   name: 'where',
   description: 'Tosch points you to a place. No guarantees it exists.',
   usage: 'where [is ...]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, wherePhrase());
   },
} satisfies PrefixCommand;
