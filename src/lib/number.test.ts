import { describe, expect, it } from 'vitest';
import { parseFiniteNumber, parseIntInRange, roundTo } from './number.js';

describe('roundTo', () => {
   it('rounds to the requested number of decimals', () => {
      expect(roundTo(1.23456, 2)).toBe(1.23);
      expect(roundTo(10 / 3, 2)).toBe(3.33);
      expect(roundTo(2.5, 0)).toBe(3);
      expect(roundTo(1.999, 0)).toBe(2);
   });

   it('defuses the float-representation artefact (1.005 → 1.01)', () => {
      expect(roundTo(1.005, 2)).toBe(1.01);
   });

   it('defaults to 2 decimals', () => {
      expect(roundTo(3.14159)).toBe(3.14);
   });
});

describe('parseFiniteNumber', () => {
   it('parses finite numbers', () => {
      expect(parseFiniteNumber('12')).toBe(12);
      expect(parseFiniteNumber('1.5')).toBe(1.5);
      expect(parseFiniteNumber('-3')).toBe(-3);
      expect(parseFiniteNumber('1e3')).toBe(1000);
   });

   it('rejects empty/blank/non-numeric/undefined', () => {
      expect(parseFiniteNumber('')).toBeNull();
      expect(parseFiniteNumber('   ')).toBeNull();
      expect(parseFiniteNumber('abc')).toBeNull();
      expect(parseFiniteNumber('12px')).toBeNull();
      expect(parseFiniteNumber(undefined)).toBeNull();
   });
});

describe('parseIntInRange', () => {
   it('accepts integers within range', () => {
      expect(parseIntInRange('3', 1, 4)).toBe(3);
      expect(parseIntInRange('1', 1, 4)).toBe(1);
      expect(parseIntInRange('4', 1, 4)).toBe(4);
   });

   it('rejects out-of-range, non-integer, non-numeric and undefined', () => {
      expect(parseIntInRange('5', 1, 4)).toBeNull();
      expect(parseIntInRange('0', 1, 4)).toBeNull();
      expect(parseIntInRange('2.5', 1, 4)).toBeNull();
      expect(parseIntInRange('x', 1, 4)).toBeNull();
      expect(parseIntInRange(undefined, 1, 4)).toBeNull();
   });
});
