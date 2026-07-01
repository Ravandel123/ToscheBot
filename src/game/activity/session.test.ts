import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVITY_TTL_MS, isExpired, nextExpiry } from './session.js';

describe('nextExpiry', () => {
   it('adds the TTL to the given moment', () => {
      const now = new Date('2026-06-16T12:00:00.000Z');
      expect(nextExpiry(60_000, now)).toEqual(new Date('2026-06-16T12:01:00.000Z'));
   });

   it('defaults to the standard TTL', () => {
      const now = new Date('2026-06-16T12:00:00.000Z');
      expect(nextExpiry(undefined, now).getTime()).toBe(now.getTime() + DEFAULT_ACTIVITY_TTL_MS);
   });
});

describe('isExpired', () => {
   const now = new Date('2026-06-16T12:00:00.000Z');

   it('is true once the deadline has passed (inclusive)', () => {
      expect(isExpired(new Date('2026-06-16T11:59:59.000Z'), now)).toBe(true);
      expect(isExpired(now, now)).toBe(true);
   });

   it('is false while the deadline is still ahead', () => {
      expect(isExpired(new Date('2026-06-16T12:00:01.000Z'), now)).toBe(false);
   });
});
