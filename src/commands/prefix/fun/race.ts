import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked, targetFromArgs } from '../../../lib/discord.js';
import { raceRoast } from '../../../fun/roast.js';

export default {
   name: 'race',
   description: 'Tosch assigns someone a Beyond the Western Deep race.',
   usage: 'race [@user or name]',
   category: 'fun',
   async execute(message, args) {
      await replyChunked(message, raceRoast(targetFromArgs(message, args)));
   },
} satisfies PrefixCommand;
