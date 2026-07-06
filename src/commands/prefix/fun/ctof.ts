import type { PrefixCommand } from '../../../types/commands.js';
import { parseFiniteNumber, parseIntInRange, roundTo } from '../../../lib/number.js';
import { celsiusToFahrenheit } from '../../../lib/units.js';

export default {
   name: 'ctof',
   description: 'Converts degrees Celsius to Fahrenheit.',
   usage: 'ctof <°C> [decimals 0-100]',
   category: 'fun',
   async execute(message, args) {
      const celsius = parseFiniteNumber(args[0]);
      if (celsius === null) {
         await message.reply('Give me a temperature in °C, e.g. `h!ctof 100`.');
         return;
      }

      const decimals = parseIntInRange(args[1], 0, 100) ?? 2;
      await message.reply(`${celsius}°C = ${roundTo(celsiusToFahrenheit(celsius), decimals)}°F`);
   },
} satisfies PrefixCommand;
