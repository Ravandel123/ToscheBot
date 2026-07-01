import { time, type TimestampStylesString } from 'discord.js';
import { PrefixCommand } from '../../../types/commands.js';

// Discord's dynamic timestamp styles (render per-viewer in their own timezone).
const FORMATS: readonly string[] = ['t', 'T', 'd', 'D', 'f', 'F', 'R'];

type ParsedTimestamp = { date: Date; format: TimestampStylesString } | { error: string };

/**
 * Parses `[date] [time] [format]` into a date + style. The format (a single style
 * letter) is detected as a trailing arg; everything before it is the date/time
 * string (empty → now). Pure, so it's unit-tested. Note: a bare date/time string is
 * parsed in the host's local timezone (a known, accepted limitation).
 */
export function parseTimestamp(args: string[]): ParsedTimestamp {
   const parts = [...args];
   let format = 'F';

   if (parts.length > 0 && FORMATS.includes(parts[parts.length - 1]))
      format = parts.pop()!;

   const input = parts.join(' ').trim();
   const date = input ? new Date(/^\d+$/.test(input) ? Number(input) : input) : new Date();

   if (Number.isNaN(date.getTime()))
      return { error: "That's not a date I understand. Try `h!timestamp 2025-02-20 15:00 F`." };

   return { date, format: format as TimestampStylesString };
}

export default {
   name: 'timestamp',
   aliases: ['ts'],
   description: 'Builds a Discord timestamp that renders in everyone\'s own timezone.',
   usage: 'timestamp [YYYY-MM-DD] [HH:MM] [format t/T/f/F/d/D/R]',
   category: 'utility',
   async execute(message, args) {
      const parsed = parseTimestamp(args);

      if ('error' in parsed) {
         await message.reply(parsed.error);
         return;
      }

      const rendered = time(parsed.date, parsed.format);
      // Inline-code copy of the same tag so it's both shown live and copy-pasteable.
      await message.reply(`${rendered}\n\`${rendered}\``);
   },
} satisfies PrefixCommand;
