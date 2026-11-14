import type { PrefixCommand } from '../../../types/commands.js';
import { buildSessionOverview } from '../../components/_sessionAdminView.js';

export default {
   name: 'session',
   aliases: ['sessions'],
   description: 'List every unfinished activity and end one that got stuck.',
   category: 'admin',
   ownerOnly: true,
   async execute(message) {
      await message.reply(await buildSessionOverview());
   },
} satisfies PrefixCommand;
