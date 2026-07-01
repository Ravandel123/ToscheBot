import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { weaponList } from '../../../fun/reactions.js';

export default {
   name: 'weapons',
   description: 'Tosch hands you a whole arsenal.',
   usage: 'weapons',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, weaponList());
   },
} satisfies PrefixCommand;
