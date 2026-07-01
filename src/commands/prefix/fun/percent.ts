import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { percentPhrase } from '../../../fun/amount.js';

export default {
   name: 'percent',
   description: 'Tosch states the percentage of something.',
   usage: 'percent [of what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, percentPhrase());
   },
} satisfies PrefixCommand;
