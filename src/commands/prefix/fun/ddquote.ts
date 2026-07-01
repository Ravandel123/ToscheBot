import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { bold } from '../../../lib/text.js';
import { darkestDungeonQuote, resolveDDCategory } from '../../../fun/darkestDungeon.js';

export default {
   name: 'ddquote',
   aliases: ['darkestdungeon'],
   description: 'A Darkest Dungeon narration line, optionally from a category.',
   usage: 'ddquote [affliction|virtue|crit|hit|deathsdoor|deathblow|victory]',
   category: 'fun',
   async execute(message, args) {
      const category = resolveDDCategory(args[0]);
      await replyChunked(message, bold(`"${darkestDungeonQuote(category)}"`));
   },
} satisfies PrefixCommand;
