import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { randomWeapon } from '../../../fun/reactions.js';

export default {
   name: 'weapon',
   description: 'Tosch hands you a random weapon.',
   usage: 'weapon',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, randomWeapon());
   },
} satisfies PrefixCommand;
