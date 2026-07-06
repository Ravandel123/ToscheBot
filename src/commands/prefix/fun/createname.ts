import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { randomInt } from '../../../lib/random.js';
import { parseIntInRange } from '../../../lib/number.js';
import { createName, parseGender, randomGender, MAX_NAMES, MAX_PARTS } from '../../../fun/names.js';

const MAX_SYLLABLE_LENGTH = 12;

// `h!createname <syllable> [gender] [position] [length] [count]` — random names
// that contain your syllable at a chosen position. Only the syllable is required;
// the rest default to random (length is kept >= position so the syllable fits).
export default {
   name: 'createname',
   aliases: ['namewith'],
   description: 'Generates names built around a syllable you provide.',
   usage: 'createname <syllable> [gender m/f] [position 1-4] [length 1-4] [count 1-100]',
   category: 'fun',
   async execute(message, args) {
      const syllable = args[0]?.trim();
      if (!syllable || syllable.length > MAX_SYLLABLE_LENGTH) {
         await message.reply(`Give me a syllable to build around (1–${MAX_SYLLABLE_LENGTH} characters), e.g. \`h!createname Clo male 1\`.`);
         return;
      }

      const gender = args[1] ? parseGender(args[1]) : randomGender();
      if (!gender) {
         await message.reply(`**${args[1]}** isn't a gender I know — try \`m\`/\`male\` or \`f\`/\`female\`.`);
         return;
      }

      const position = args[2] === undefined ? randomInt(1, MAX_PARTS) : parseIntInRange(args[2], 1, MAX_PARTS);
      if (position === null) {
         await message.reply(`Position must be a whole number from 1 to ${MAX_PARTS}.`);
         return;
      }

      // Length must be at least the position, or the syllable's slot wouldn't exist.
      const length = args[3] === undefined ? randomInt(position, MAX_PARTS) : parseIntInRange(args[3], position, MAX_PARTS);
      if (length === null) {
         await message.reply(`Name length must be a whole number from ${position} to ${MAX_PARTS} (at least the position).`);
         return;
      }

      const count = args[4] === undefined ? 1 : parseIntInRange(args[4], 1, MAX_NAMES);
      if (count === null) {
         await message.reply(`I can make between 1 and ${MAX_NAMES} names at once.`);
         return;
      }

      const names = Array.from({ length: count }, () => createName(syllable, gender, position, length));
      await replyChunked(message, names.join(', '));
   },
} satisfies PrefixCommand;
