import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { costPhrase } from '../../../fun/cost.js';

// Thin by design: all the flavour lives in fun/cost.ts (data + generator + grammar).
export default {
   name: 'cost',
   aliases: ['price', 'worth'],
   description: 'Tosch appraises what something is worth.',
   usage: 'cost <thing>',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, costPhrase());
   },
} satisfies PrefixCommand;
