// Factory for the most common kind of troll command: "pick a random line and
// reply". Adding a new one is then just a data list + a tiny declarative call,
// instead of repeating the pick/format/reply boilerplate. The `_` prefix keeps
// the loader from treating this file as a command.
import { PrefixCommand, PrefixCategory } from '../../types/commands.js';
import { randomItem } from '../../lib/random.js';
import { replyChunked } from '../../lib/discord.js';
import { funnyEnding } from '../../fun/flavor.js';

export interface RandomResponseCommandOptions {
   name: string;
   aliases?: string[];
   description: string;
   usage?: string;
   category?: PrefixCategory; // defaults to 'fun'
   cooldownSeconds?: number;
   /** The pool of canned replies. Lines starting with `http` are sent as-is. */
   responses: readonly string[];
   /** Extra lines computed fresh each call (e.g. containing a random number). */
   extraResponses?: () => readonly string[];
   /** Append Tosch's `, yes-yes` tic to non-URL replies. Default false. */
   funny?: boolean;
}

export function defineRandomResponseCommand(options: RandomResponseCommandOptions): PrefixCommand {
   return {
      name: options.name,
      aliases: options.aliases,
      description: options.description,
      usage: options.usage,
      category: options.category ?? 'fun',
      cooldownSeconds: options.cooldownSeconds,
      async execute(message) {
         const pool = options.extraResponses
            ? [...options.responses, ...options.extraResponses()]
            : options.responses;

         let response = randomItem(pool);

         if (options.funny && !response.startsWith('http'))
            response += funnyEnding();

         await replyChunked(message, response);
      },
   };
}
