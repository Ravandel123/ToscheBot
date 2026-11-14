import { JobState } from '../models/jobState.js';

const HOUR_MS = 3_600_000;

/** The clock hour `date` falls in, as hours since the Unix epoch. */
export function epochHour(date: Date = new Date()): number {
   return Math.floor(date.getTime() / HOUR_MS);
}

export const jobStateService = {
   /**
    * How many hourly ticks `jobName` owes as of `now`, and marks them taken.
    * 0 when this hour was already accounted for (a restart inside the hour, a
    * double-fired cron) and on the very first call ever (nothing to catch up —
    * the clock just starts). Capped at `maxHours` so a long outage cannot hand
    * out an unbounded lump. Read-then-write is safe: one process, one caller.
    */
   async claimHours(jobName: string, maxHours: number, now: Date = new Date()): Promise<number> {
      const hour = epochHour(now);
      const state = await JobState.findById(jobName).lean();
      const last = state?.lastHour;
      const owed = last === undefined ? 0 : Math.max(0, hour - last);

      if (last === undefined || owed > 0)
         await JobState.updateOne({ _id: jobName }, { $set: { lastHour: hour } }, { upsert: true });

      return Math.min(owed, maxHours);
   },

   /**
    * True the first time `name` is asked about `day` — and marks the day taken,
    * so every later call that day says false. Unlike `claimHours`, the very
    * first call ever is due (a daily routine should run on its first day).
    * Missed days are not made up: the routine simply runs once when next asked.
    * Read-then-write is safe: one process, and callers hold a lock.
    */
   async claimDay(name: string, day: number): Promise<boolean> {
      const state = await JobState.findById(name).lean();
      if (state?.lastDay === day)
         return false;

      await JobState.updateOne({ _id: name }, { $set: { lastDay: day } }, { upsert: true });
      return true;
   },
};
