import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { rantReply } from '../../../fun/reactions.js';

export default {
   name: 'rant',
   description: 'Vent to Tosch. He will be deeply unsympathetic.',
   usage: 'rant <your complaint>',
   category: 'fun',
   async execute(message, args) {
      await replyChunked(message, rantReply(args.length > 0));
   },
} satisfies PrefixCommand;
