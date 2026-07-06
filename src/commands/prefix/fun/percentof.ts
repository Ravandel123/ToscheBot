import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked, targetFromArgs } from '../../../lib/discord.js';
import { percentApplied } from '../../../fun/amount.js';

// `h!% <trait> [who]` → "Tosch is 73% awesome". First arg is the trait; the rest
// (or you, by default) is who it's applied to.
export default {
   name: '%',
   aliases: ['percentof'],
   description: 'Tosch rates how much of a trait someone has.',
   usage: '% <trait> [who]',
   category: 'fun',
   async execute(message, args) {
      const what = args[0];
      if (!what) {
         await message.reply('Tell me a trait, e.g. `h!% awesome Tosch`.');
         return;
      }

      const who = targetFromArgs(message, args.slice(1));
      await replyChunked(message, percentApplied(who, what));
   },
} satisfies PrefixCommand;
