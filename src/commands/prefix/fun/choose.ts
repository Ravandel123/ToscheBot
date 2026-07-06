import type { PrefixCommand } from '../../../types/commands.js';
import { randomItem } from '../../../lib/random.js';
import { bold } from '../../../lib/text.js';
import { replyChunked } from '../../../lib/discord.js';

export default {
   name: 'choose',
   aliases: ['pick'],
   description: 'Tosch chooses one of several options.',
   usage: 'option a | option b | option c',
   category: 'fun',
   async execute(message, args) {
      const options = args
         .join(' ')
         .split('|')
         .map((option) => option.trim())
         .filter((option) => option.length > 0);

      if (options.length < 2) {
         await message.reply('Give me at least two options, separated by `|`.');
         return;
      }

      await replyChunked(message, `I choose ${bold(randomItem(options))}.`);
   },
} satisfies PrefixCommand;
