import { PrefixCommand } from '../../../types/commands.js';
import { parseFiniteNumber, parseIntInRange } from '../../../lib/number.js';
import { kgToImperial } from '../../../lib/units.js';

export default {
   name: 'kgtoimperial',
   aliases: ['kgtolb'],
   description: 'Converts kilograms to pounds and ounces.',
   usage: 'kgtoimperial <kg> [decimals 0-100]',
   category: 'fun',
   async execute(message, args) {
      const kilograms = parseFiniteNumber(args[0]);
      if (kilograms === null) {
         await message.reply('Give me a weight in kg, e.g. `h!kgtoimperial 80`.');
         return;
      }

      const decimals = parseIntInRange(args[1], 0, 100) ?? 0;
      await message.reply(`${kilograms} kg = ${kgToImperial(kilograms, decimals)}`);
   },
} satisfies PrefixCommand;
