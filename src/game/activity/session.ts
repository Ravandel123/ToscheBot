// Pure helpers + tunables for durable activity sessions (CLAUDE.md D17). No DB,
// no Discord — just the timing rules, so they're trivially testable.

/** How long a session may sit idle before it's considered abandoned (and TTL-reaped). */
export const DEFAULT_ACTIVITY_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** The next inactivity deadline — refreshed on every step so active play keeps a session alive. */
export function nextExpiry(ttlMs: number = DEFAULT_ACTIVITY_TTL_MS, now: Date = new Date()): Date {
   return new Date(now.getTime() + ttlMs);
}

/** Whether a session's deadline has passed (lazy expiry check, complements the DB TTL index). */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
   return expiresAt.getTime() <= now.getTime();
}
