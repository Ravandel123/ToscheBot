import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { amountPhrase } from '../../../fun/amount.js';

export default {
   name: 'amount',
   description: 'Tosch states the amount of something.',
   usage: 'amount [of what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, amountPhrase());
   },
} satisfies PrefixCommand;
