import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { whyAnswer } from '../../../fun/reasons.js';

export default {
   name: 'why',
   description: 'Tosch reveals the true cause of anything.',
   usage: 'why [is ...]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, whyAnswer());
   },
} satisfies PrefixCommand;
