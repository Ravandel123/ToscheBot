import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { sizePhrase } from '../../../fun/measurements.js';

export default {
   name: 'size',
   description: 'Tosch judges how big or small something is.',
   usage: 'size [of what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, sizePhrase());
   },
} satisfies PrefixCommand;
