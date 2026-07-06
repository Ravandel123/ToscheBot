import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { howAnswer } from '../../../fun/reasons.js';

export default {
   name: 'how',
   description: 'Tosch explains how anything is done.',
   usage: 'how [do I ...]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, howAnswer());
   },
} satisfies PrefixCommand;
