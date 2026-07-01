import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked, targetFromArgs } from '../../../lib/discord.js';
import { hugPhrase } from '../../../fun/reactions.js';

export default {
   name: 'hug',
   description: 'Tosch hugs someone. Maybe.',
   usage: 'hug [@user or name]',
   category: 'fun',
   async execute(message, args) {
      await replyChunked(message, hugPhrase(targetFromArgs(message, args)));
   },
} satisfies PrefixCommand;
