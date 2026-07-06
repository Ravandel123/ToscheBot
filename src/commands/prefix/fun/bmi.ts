import type { PrefixCommand } from '../../../types/commands.js';
import { parseFiniteNumber } from '../../../lib/number.js';
import { bmi } from '../../../lib/units.js';
import { BODY_SHAPES } from '../../../fun/bodyShapes.js';

export default {
   name: 'bmi',
   description: 'Calculates your BMI (Body Mass Index).',
   usage: 'bmi <height cm> <weight kg>',
   category: 'fun',
   async execute(message, args) {
      const height = parseFiniteNumber(args[0]);
      const weight = parseFiniteNumber(args[1]);

      if (height === null || weight === null || height <= 0 || weight <= 0) {
         await message.reply('Give me a height and weight, e.g. `h!bmi 180 80`.');
         return;
      }

      const value = bmi(height, weight);
      const shapes = BODY_SHAPES
         .filter((shape) => value >= shape.minBmi && value <= shape.maxBmi)
         .map((shape) => shape.name)
         .join(' or ') || 'off the charts';

      await message.reply(`Your BMI: ${value} (${shapes})`);
   },
} satisfies PrefixCommand;
