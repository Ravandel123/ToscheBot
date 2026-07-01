import { PrefixCommand } from '../../../types/commands.js';
import { replyChunked } from '../../../lib/discord.js';
import { randomPerson } from '../../../fun/people.js';
import { funnyEnding } from '../../../fun/flavor.js';

export default {
   name: 'who',
   description: 'Tosch names a person, when asked a "who" question.',
   usage: "is Tosch's favourite person?",
   category: 'fun',
   async execute(message) {
      await replyChunked(message, `${randomPerson()}${funnyEnding()}`);
   },
} satisfies PrefixCommand;
