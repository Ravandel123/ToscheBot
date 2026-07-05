import { describe, expect, it } from 'vitest';
import { isValidTimeZone } from './datetime.js';

describe('isValidTimeZone', () => {
   it('accepts real IANA zones', () => {
      expect(isValidTimeZone('Europe/Warsaw')).toBe(true);
      expect(isValidTimeZone('America/New_York')).toBe(true);
      expect(isValidTimeZone('UTC')).toBe(true);
   });

   it('rejects unknown zones and blanks', () => {
      expect(isValidTimeZone('Middle/Earth')).toBe(false);
      expect(isValidTimeZone('Warsaw')).toBe(false);
      expect(isValidTimeZone('')).toBe(false);
      expect(isValidTimeZone('   ')).toBe(false);
   });
});
