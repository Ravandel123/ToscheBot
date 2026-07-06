import type { PrefixCommand } from '../../../types/commands.js';

export default {
   name: 'ping',
   description: 'Checks whether Tosch is paying attention.',
   category: 'utility',
   cooldownSeconds: 3,
   async execute(message) {
      await message.reply('Pong! I am always watching, yes-yes.');
   },
} satisfies PrefixCommand;
