import type { PrefixCommand } from '../../../types/commands.js';
import { replyChunked, targetFromArgs } from '../../../lib/discord.js';
import { whoisPhrase } from '../../../fun/roast.js';

export default {
   name: 'whois',
   description: 'Tosch reveals who someone really is.',
   usage: 'whois [@user or name]',
   category: 'fun',
   async execute(message, args) {
      await replyChunked(message, whoisPhrase(targetFromArgs(message, args)));
   },
} satisfies PrefixCommand;
