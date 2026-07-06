import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked, targetFromArgs } from '../../../lib/discord.js';
import { classRoast } from '../../../fun/roast.js';

export default {
   name: 'class',
   description: 'Tosch names the class someone was born for.',
   usage: 'class [@user or name]',
   category: 'fun',
   async execute(message, args) {
      await replyChunked(message, classRoast(targetFromArgs(message, args)));
   },
} satisfies PrefixCommand;
