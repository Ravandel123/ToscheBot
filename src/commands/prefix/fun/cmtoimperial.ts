import type { PrefixCommand } from '../../../types/commands.js';
import { parseFiniteNumber, parseIntInRange } from '../../../lib/number.js';
import { cmToImperial } from '../../../lib/units.js';

export default {
   name: 'cmtoimperial',
   aliases: ['cmtoft'],
   description: 'Converts centimetres to feet and inches.',
   usage: 'cmtoimperial <cm> [decimals 0-100]',
   category: 'fun',
   async execute(message, args) {
      const centimetres = parseFiniteNumber(args[0]);
      if (centimetres === null) {
         await message.reply('Give me a length in cm, e.g. `h!cmtoimperial 180`.');
         return;
      }

      const decimals = parseIntInRange(args[1], 0, 100) ?? 0;
      await message.reply(`${centimetres} cm = ${cmToImperial(centimetres, decimals)}`);
   },
} satisfies PrefixCommand;
