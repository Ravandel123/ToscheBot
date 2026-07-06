import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { capitalize } from '../../../lib/text.js';
import { parseFiniteNumber } from '../../../lib/number.js';
import { bmiWeight, kgToImperial } from '../../../lib/units.js';
import { BODY_SHAPES } from '../../../fun/bodyShapes.js';

export default {
   name: 'bmiforheight',
   aliases: ['bmifh'],
   description: 'Shows the weight range for each BMI body shape at a given height.',
   usage: 'bmiforheight <height cm>',
   category: 'fun',
   async execute(message, args) {
      const height = parseFiniteNumber(args[0]);
      if (height === null || height <= 0) {
         await message.reply('Give me a height in cm, e.g. `h!bmiforheight 176`.');
         return;
      }

      const lines = BODY_SHAPES.map((shape) => {
         const minKg = bmiWeight(height, shape.minBmi);
         const maxKg = bmiWeight(height, shape.maxBmi);
         return `${capitalize(shape.name)}: **${minKg} kg – ${maxKg} kg** // **${kgToImperial(minKg)} – ${kgToImperial(maxKg)}**`;
      });

      await replyChunked(message, lines.join('\n'));
   },
} satisfies PrefixCommand;
