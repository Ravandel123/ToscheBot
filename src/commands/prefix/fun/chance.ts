import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { chancePhrase } from '../../../fun/amount.js';

export default {
   name: 'chance',
   aliases: ['chances'],
   description: 'Tosch states the chance of something.',
   usage: 'chance [that ...]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, chancePhrase());
   },
} satisfies PrefixCommand;
