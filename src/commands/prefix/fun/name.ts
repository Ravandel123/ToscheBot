import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { randomInt } from '../../../lib/random.js';
import { parseIntInRange } from '../../../lib/number.js';
import { generateName, parseGender, randomGender, totalNameCount, MAX_NAMES, MAX_PARTS } from '../../../fun/names.js';

// `h!name [gender] [length 1-4] [count 1-100]` — random fantasy name(s). All args
// optional (gender + length default to random). `h!name count` reports the total.
export default {
   name: 'name',
   aliases: ['names'],
   description: 'Generates random fantasy name(s).',
   usage: 'name [gender m/f] [length 1-4] [count 1-100]   ·   name count',
   category: 'fun',
   async execute(message, args) {
      const first = args[0]?.toLowerCase();

      if (first === 'count' || first === 'total') {
         await message.reply(`I could conjure roughly **${totalNameCount().toLocaleString('en-US')}** different names.`);
         return;
      }

      const gender = first ? parseGender(first) : randomGender();
      if (!gender) {
         await message.reply(`**${args[0]}** isn't a gender I know — try \`m\`/\`male\` or \`f\`/\`female\`.`);
         return;
      }

      const length = args[1] === undefined ? randomInt(1, MAX_PARTS) : parseIntInRange(args[1], 1, MAX_PARTS);
      if (length === null) {
         await message.reply(`Name length must be a whole number from 1 to ${MAX_PARTS}.`);
         return;
      }

      const count = args[2] === undefined ? 1 : parseIntInRange(args[2], 1, MAX_NAMES);
      if (count === null) {
         await message.reply(`I can make between 1 and ${MAX_NAMES} names at once.`);
         return;
      }

      const names = Array.from({ length: count }, () => generateName(gender, length));
      await replyChunked(message, names.join(', '));
   },
} satisfies PrefixCommand;
