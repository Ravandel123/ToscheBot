// Generic date/time helpers — no Discord, no game logic.

/**
 * Whether a string is an IANA timezone the runtime recognises (e.g.
 * 'Europe/Warsaw', 'America/New_York'). `Intl.DateTimeFormat` throws a
 * RangeError when constructed with an unknown zone, which we treat as invalid.
 */
export function isValidTimeZone(timeZone: string): boolean {
   if (!timeZone.trim())
      return false;

   try {
      Intl.DateTimeFormat(undefined, { timeZone });
      return true;
   } catch {
      return false;
   }
}
