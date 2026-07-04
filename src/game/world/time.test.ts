import { describe, expect, it } from 'vitest';
import { GAME_UTC_OFFSET_HOURS, TIMES_OF_DAY, gameHour, timeOfDay } from './time.js';

/** A real instant whose GAME clock reads the given hour. */
const atGameHour = (hour: number): Date =>
   new Date(Date.UTC(2026, 0, 1, (hour - GAME_UTC_OFFSET_HOURS + 24) % 24));

describe('gameHour', () => {
   it('shifts UTC by the game offset', () => {
      expect(gameHour(atGameHour(6))).toBe(6);
      expect(gameHour(atGameHour(0))).toBe(0);
      expect(gameHour(atGameHour(23))).toBe(23);
   });
});

describe('timeOfDay', () => {
   it('starts each period exactly at its catalog fromHour', () => {
      expect(timeOfDay(atGameHour(TIMES_OF_DAY.morning.fromHour))).toBe('morning');
      expect(timeOfDay(atGameHour(TIMES_OF_DAY.day.fromHour))).toBe('day');
      expect(timeOfDay(atGameHour(TIMES_OF_DAY.evening.fromHour))).toBe('evening');
      expect(timeOfDay(atGameHour(TIMES_OF_DAY.night.fromHour))).toBe('night');
   });

   it('covers the whole day, with night wrapping past midnight', () => {
      expect(timeOfDay(atGameHour(0))).toBe('night');
      expect(timeOfDay(atGameHour(5))).toBe('night');
      expect(timeOfDay(atGameHour(10))).toBe('morning');
      expect(timeOfDay(atGameHour(17))).toBe('day');
      expect(timeOfDay(atGameHour(21))).toBe('evening');
      expect(timeOfDay(atGameHour(23))).toBe('night');
   });
});
