import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { weightPhrase } from '../../../fun/measurements.js';

export default {
   name: 'weight',
   aliases: ['mass', 'heaviness'],
   description: 'Tosch weighs anything you ask about.',
   usage: 'weight [of what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, weightPhrase());
   },
} satisfies PrefixCommand;
