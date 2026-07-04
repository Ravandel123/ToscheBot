// The game world's clock (D31). Deltrada's day runs on the OWNER's wall clock,
// not the host's TZ setting (Sparkedhost may run UTC): night in Poland is night
// in Deltrada, so "the market is closed at night" matches when players are
// actually up. Fixed UTC offset on purpose — a one-hour DST drift is invisible
// to gameplay and not worth a timezone library.

export type TimeOfDayId = 'morning' | 'day' | 'evening' | 'night';

export interface TimeOfDayDefinition {
   name: string;
   emoji: string;
   /** Inclusive start hour on the 24h game clock (night wraps past midnight). */
   fromHour: number;
}

/** Game clock = UTC + this many hours (owner's timezone; 🟡 tunable). */
export const GAME_UTC_OFFSET_HOURS = 2;

export const TIMES_OF_DAY = {
   morning: { name: 'Morning', emoji: '🌅', fromHour: 6 },
   day: { name: 'Daytime', emoji: '🌞', fromHour: 11 },
   evening: { name: 'Evening', emoji: '🌇', fromHour: 18 },
   night: { name: 'Night', emoji: '🌙', fromHour: 22 },
} as const satisfies Record<TimeOfDayId, TimeOfDayDefinition>;

/** The game-clock hour (0–23) for a real instant. */
export function gameHour(date = new Date()): number {
   return (date.getUTCHours() + GAME_UTC_OFFSET_HOURS) % 24;
}

/** Which part of the game day a real instant falls in. Pure. */
export function timeOfDay(date = new Date()): TimeOfDayId {
   const hour = gameHour(date);

   if (hour >= TIMES_OF_DAY.night.fromHour || hour < TIMES_OF_DAY.morning.fromHour)
      return 'night';
   if (hour >= TIMES_OF_DAY.evening.fromHour)
      return 'evening';
   if (hour >= TIMES_OF_DAY.day.fromHour)
      return 'day';
   return 'morning';
}
