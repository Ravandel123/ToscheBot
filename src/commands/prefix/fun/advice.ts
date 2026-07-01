import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { advicePhrase } from '../../../fun/advice.js';

export default {
   name: 'advice',
   aliases: ['therapy'],
   description: 'Tosch dispenses life advice. Do not follow it.',
   usage: 'advice [about what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, advicePhrase());
   },
} satisfies PrefixCommand;
