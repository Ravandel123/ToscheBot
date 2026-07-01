import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { celebratePhrase } from '../../../fun/reactions.js';

export default {
   name: 'celebrate',
   aliases: ['party'],
   description: 'Tosch reacts to your celebration.',
   usage: 'celebrate [what]',
   category: 'fun',
   async execute(message) {
      await replyChunked(message, celebratePhrase());
   },
} satisfies PrefixCommand;
