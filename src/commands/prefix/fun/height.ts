import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { lengthPhrase } from '../../../fun/measurements.js';

export default {
   name: 'height',
   aliases: ['length', 'width'],
   description: 'Tosch measures the size of anything.',
   usage: 'height [of what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, lengthPhrase());
   },
} satisfies PrefixCommand;
