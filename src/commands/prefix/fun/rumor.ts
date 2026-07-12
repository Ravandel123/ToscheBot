import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { rumorPhrase } from '../../../fun/rumor.js';

// Thin by design: the flavour lives in fun/rumor.ts on top of grammar/sentence.ts.
export default {
   name: 'rumor',
   aliases: ['gossip', 'rumour'],
   description: 'Tosch shares the latest completely reliable rumor.',
   usage: 'rumor',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, rumorPhrase());
   },
} satisfies PrefixCommand;
