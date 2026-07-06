import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { whenPhrase } from '../../../fun/measurements.js';

export default {
   name: 'when',
   description: 'Tosch answers any "when" question with total confidence.',
   usage: 'when [will ...]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, whenPhrase());
   },
} satisfies PrefixCommand;
