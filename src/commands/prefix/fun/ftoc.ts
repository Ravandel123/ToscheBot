import { PrefixCommand } from '../../../types/commands.js';
import { parseFiniteNumber, parseIntInRange, roundTo } from '../../../lib/number.js';
import { fahrenheitToCelsius } from '../../../lib/units.js';

export default {
   name: 'ftoc',
   description: 'Converts degrees Fahrenheit to Celsius.',
   usage: 'ftoc <°F> [decimals 0-100]',
   category: 'fun',
   async execute(message, args) {
      const fahrenheit = parseFiniteNumber(args[0]);
      if (fahrenheit === null) {
         await message.reply('Give me a temperature in °F, e.g. `h!ftoc 50`.');
         return;
      }

      const decimals = parseIntInRange(args[1], 0, 100) ?? 2;
      await message.reply(`${fahrenheit}°F = ${roundTo(fahrenheitToCelsius(fahrenheit), decimals)}°C`);
   },
} satisfies PrefixCommand;
