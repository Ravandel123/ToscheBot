import type { PrefixCommand } from '../../../types/commands.js';
import { countSyllables } from '../../../lib/text.js';

export default {
   name: 'syllables',
   aliases: ['syl'],
   description: 'Counts the syllables in a word.',
   usage: 'syllables <word>',
   category: 'fun',
   async execute(message, args) {
      const word = args[0];
      if (!word) {
         await message.reply('Give me a word, e.g. `h!syllables deltrada`.');
         return;
      }

      const count = countSyllables(word);
      await message.reply(count > 0
         ? `The word '${word}' has ${count} syllable${count === 1 ? '' : 's'}.`
         : `The word '${word}' has no syllables.`);
   },
} satisfies PrefixCommand;
