import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { moodPhrase } from '../../../fun/mood.js';

export default {
   name: 'mood',
   description: 'Tosch tells you what he is currently up to.',
   usage: 'mood',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, moodPhrase());
   },
} satisfies PrefixCommand;
