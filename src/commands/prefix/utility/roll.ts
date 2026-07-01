import { PrefixCommand } from '../../../types/commands.js';
import { randomInt } from '../../../lib/random.js';
import { replyChunked } from '../../../lib/discord.js';

const MAX_DICE = 100;
const MAX_SIDES = 1_000_000;

export default {
   name: 'roll',
   aliases: ['dice'],
   description: 'Rolls dice. Accepts a die size or NdM notation.',
   usage: '[sides | NdM]   e.g. roll, roll 20, roll 2d6',
   category: 'utility',
   async execute(message, args) {
      const input = (args[0] ?? '100').toLowerCase();
      const dice = /^(\d+)d(\d+)$/.exec(input);

      if (dice) {
         const count = Number(dice[1]);
         const sides = Number(dice[2]);

         if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) {
            await message.reply(`Keep it sane: 1–${MAX_DICE} dice, 2–${MAX_SIDES} sides.`);
            return;
         }

         const rolls = Array.from({ length: count }, () => randomInt(1, sides));
         const total = rolls.reduce((sum, roll) => sum + roll, 0);
         const breakdown = count > 1 ? ` (${rolls.join(' + ')})` : '';

         await replyChunked(message, `🎲 **${total}**${breakdown}`);
         return;
      }

      const sides = Number(input);

      if (!Number.isInteger(sides) || sides < 2 || sides > MAX_SIDES) {
         await message.reply('Give me a die size (`roll 20`) or NdM (`roll 2d6`).');
         return;
      }

      await replyChunked(message, `🎲 **${randomInt(1, sides)}** (d${sides})`);
   },
} satisfies PrefixCommand;
