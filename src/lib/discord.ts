import { Guild, GuildBasedChannel, Message } from 'discord.js';

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Finds a guild channel by id or by name. A reference that is all digits (17–20
 * of them) is treated as an id (rename-proof); anything else as a name. Lets
 * settings use whichever is handier per channel.
 */
export function resolveGuildChannel(guild: Guild, idOrName: string): GuildBasedChannel | undefined {
   if (/^\d{17,20}$/.test(idOrName))
      return guild.channels.cache.get(idOrName);

   return guild.channels.cache.find((channel) => channel.name === idOrName);
}

/**
 * Resolves the "who/what" a fun command targets from its args: empty or "me"/"i"
 * means the author (returned as a mention), otherwise the joined free text.
 */
export function targetFromArgs(message: Message, args: string[]): string {
   const text = args.join(' ').trim();

   if (!text || text.toLowerCase() === 'me' || text.toLowerCase() === 'i')
      return message.author.toString();

   return text;
}

/**
 * Splits text into Discord-sized chunks, preferring to break on line
 * boundaries and only hard-splitting a single line that is itself too long.
 * The old bot's naive `.send()` threw on > 2000 chars; this never does.
 */
export function chunkMessage(content: string, maxLength = MAX_MESSAGE_LENGTH): string[] {
   if (content.length <= maxLength)
      return [content];

   const chunks: string[] = [];
   let current = '';

   const flush = (): void => {
      if (current) {
         chunks.push(current);
         current = '';
      }
   };

   for (const line of content.split('\n')) {
      if (line.length > maxLength) {
         flush();
         for (let i = 0; i < line.length; i += maxLength)
            chunks.push(line.slice(i, i + maxLength));
         continue;
      }

      const candidate = current ? `${current}\n${line}` : line;

      if (candidate.length > maxLength) {
         flush();
         current = line;
      } else {
         current = candidate;
      }
   }

   flush();
   return chunks;
}

/**
 * Replies with `content`, transparently splitting overlong output across
 * multiple messages (first as a reply, the rest as channel sends).
 */
export async function replyChunked(message: Message, content: string): Promise<void> {
   if (!content)
      return;

   const [first, ...rest] = chunkMessage(content);
   await message.reply(first);

   for (const chunk of rest) {
      if (message.channel.isSendable())
         await message.channel.send(chunk);
   }
}
