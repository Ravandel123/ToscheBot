import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked, targetFromArgs } from '../../../lib/discord.js';
import { animalRoast } from '../../../fun/roast.js';

export default {
   name: 'animal',
   description: 'Tosch decides what animal someone resembles.',
   usage: 'animal [@user or name]',
   category: 'fun',
   async execute(message, args) {
      await replyChunked(message, animalRoast(targetFromArgs(message, args)));
   },
} satisfies PrefixCommand;
