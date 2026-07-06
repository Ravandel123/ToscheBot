import type { PrefixCommand } from '../../../types/commands.js';
import { personGrammar } from '../../../lib/person.js';
import { capitalize } from '../../../lib/text.js';
import { sleep } from '../../../lib/async.js';
import { resolveVerdict } from '../../../fun/resolve.js';

export default {
   name: 'resolve',
   description: "Tests someone's resolve.",
   usage: 'resolve [who]',
   category: 'fun',
   cooldownSeconds: 5, // it animates over a few seconds
   async execute(message, args) {
      const person = personGrammar(args.join(' '));
      const intro = `${capitalize(person.determiner)} resolve is tested`;

      // No suspense possible (e.g. a thread we can't send to): just answer.
      if (!message.channel.isSendable()) {
         await message.reply(`${intro}... ${resolveVerdict(person)}`);
         return;
      }

      // Build tension with a few trailing dots, then deliver the verdict.
      const tension = await message.channel.send(`${intro}.`).catch(() => null);
      for (let dots = 2; tension && dots <= 3; dots++) {
         await sleep(800);
         await tension.edit(`${intro}${'.'.repeat(dots)}`).catch(() => undefined);
      }

      await sleep(tension ? 1200 : 0);
      await message.channel.send(resolveVerdict(person));
   },
} satisfies PrefixCommand;
