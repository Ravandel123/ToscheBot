import { PrefixCommand } from '../../../types/commands.js';
import { randomInt, randomItem } from '../../../lib/random.js';
import { bold } from '../../../lib/text.js';
import { replyChunked } from '../../../lib/discord.js';
import { RATING_REMARKS } from '../../../fun/ratings.js';

export default {
   name: 'rate',
   description: 'Tosch passes judgement on something, out of 10.',
   usage: '<thing>',
   category: 'fun',
   async execute(message, args) {
      const subject = args.join(' ').trim() || 'yourself';
      const score = randomInt(0, 10);
      const tier = score <= 3 ? 'low' : score <= 7 ? 'mid' : 'high';
      const remark = randomItem(RATING_REMARKS[tier]);

      await replyChunked(message, `I rate ${bold(subject)} a **${score}/10**. ${remark}`);
   },
} satisfies PrefixCommand;
