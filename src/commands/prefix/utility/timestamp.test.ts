import { describe, expect, it } from 'vitest';
import { parseTimestamp } from './timestamp.js';

describe('parseTimestamp', () => {
   it('parses a date/time string with the default format', () => {
      const result = parseTimestamp(['2025-02-20T15:00:00Z']);
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
         expect(result.date.getTime()).toBe(Date.parse('2025-02-20T15:00:00Z'));
         expect(result.format).toBe('F');
      }
   });

   it('detects a trailing format letter', () => {
      const result = parseTimestamp(['2025-02-20T15:00:00Z', 'R']);
      expect('error' in result).toBe(false);
      if (!('error' in result))
         expect(result.format).toBe('R');
   });

   it('treats a lone format letter as "now" in that style', () => {
      const before = Date.now();
      const result = parseTimestamp(['R']);
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
         expect(result.format).toBe('R');
         expect(result.date.getTime()).toBeGreaterThanOrEqual(before);
      }
   });

   it('rejects an unparseable date', () => {
      const result = parseTimestamp(['not-a-date']);
      expect('error' in result).toBe(true);
      if ('error' in result)
         expect(typeof result.error).toBe('string');
   });
});
