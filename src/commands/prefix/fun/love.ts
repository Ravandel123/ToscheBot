import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { lovePhrase } from '../../../fun/love.js';

// Thin by design: all the flavour lives in fun/love.ts (templates + personGrammar).
export default {
   name: 'love',
   aliases: ['flattery', 'compliment'],
   description: 'Tosch pays you (or someone) a compliment.',
   usage: 'love [who]',
   category: 'fun',
   async execute(message, args) {
      await replyChunked(message, lovePhrase(args.join(' ')));
   },
} satisfies PrefixCommand;
