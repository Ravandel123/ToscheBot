import { PrefixCommand } from '../../../types/commands.js';
import { randomItem } from '../../../lib/random.js';
import { replyChunked, targetFromArgs } from '../../../lib/discord.js';
import { bold, capitalize } from '../../../lib/text.js';
import { DND_ALIGNMENTS } from '../../../fun/alignments.js';
import { funnyEnding } from '../../../fun/flavor.js';

export default {
   name: 'dndalign',
   aliases: ['alignment'],
   description: "Tosch divines someone's D&D alignment.",
   usage: '<person>',
   category: 'fun',
   async execute(message, args) {
      const who = targetFromArgs(message, args);
      const alignment = bold(randomItem(DND_ALIGNMENTS));

      const sentence = randomItem([
         `${who} is ${alignment}`,
         `It seems like ${who} is ${alignment}`,
         `Without a doubt, ${alignment}`,
      ]);

      await replyChunked(message, capitalize(sentence) + funnyEnding());
   },
} satisfies PrefixCommand;
