import { describe, expect, it } from 'vitest';
import {
   COMIC,
   LATEST_CHAPTER,
   clampPage,
   lastPageIndex,
   locateComic,
   pageImageUrl,
   pageOfficialUrl,
   randomComicLocation,
   resolveChapterId,
} from './comic.js';

describe('clampPage', () => {
   it('clamps below 0 and above the last page', () => {
      expect(clampPage('prologue', -5)).toBe(0);
      expect(clampPage('prologue', 9999)).toBe(lastPageIndex('prologue'));
   });

   it('truncates and tolerates non-finite input', () => {
      expect(clampPage('prologue', 2.9)).toBe(2);
      expect(clampPage('prologue', NaN)).toBe(0);
   });
});

describe('pageOfficialUrl', () => {
   it('uses the exception slug where one exists (prologue title)', () => {
      expect(pageOfficialUrl('prologue', 0)).toBe('https://www.westerndeep.net/comic/comingsoon');
   });

   it('falls back to regularUrl + page number otherwise', () => {
      expect(pageOfficialUrl('prologue', 7)).toBe('https://www.westerndeep.net/comic/prologue-page-7');
   });
});

describe('pageImageUrl', () => {
   it('returns the stored CDN url for the clamped page', () => {
      expect(pageImageUrl('prologue', 0)).toBe(COMIC.prologue.pages[0]);
      expect(pageImageUrl('prologue', 9999)).toBe(COMIC.prologue.pages.at(-1));
   });
});

describe('resolveChapterId', () => {
   it('passes through a known id and falls back on an unknown one', () => {
      expect(resolveChapterId('chapter2')).toBe('chapter2');
      expect(resolveChapterId('nonsense')).toBe('prologue');
   });
});

describe('locateComic', () => {
   it('defaults to the prologue title on empty input', () => {
      expect(locateComic('')).toEqual({ chapter: 'prologue', page: 0 });
      expect(locateComic(undefined)).toEqual({ chapter: 'prologue', page: 0 });
   });

   it('maps "latest"/"newest" to the latest chapter\'s last page', () => {
      expect(locateComic('latest')).toEqual({ chapter: LATEST_CHAPTER, page: lastPageIndex(LATEST_CHAPTER) });
   });

   it('maps a single digit to that chapter', () => {
      expect(locateComic('4')).toEqual({ chapter: 'chapter4', page: 0 });
   });

   it('matches a chapter by id or by name substring (case-insensitive)', () => {
      expect(locateComic('theScholarAndTheSeawal')).toEqual({ chapter: 'theScholarAndTheSeawal', page: 0 });
      expect(locateComic('seawal')).toEqual({ chapter: 'theScholarAndTheSeawal', page: 0 });
   });

   it('falls back to the prologue on an unrecognised arg', () => {
      expect(locateComic('zzz-nope')).toEqual({ chapter: 'prologue', page: 0 });
   });
});

describe('randomComicLocation', () => {
   it('always returns a valid chapter and an in-range page', () => {
      for (let i = 0; i < 50; i++) {
         const { chapter, page } = randomComicLocation();
         expect(Object.keys(COMIC)).toContain(chapter);
         expect(page).toBeGreaterThanOrEqual(0);
         expect(page).toBeLessThanOrEqual(lastPageIndex(chapter));
      }
   });
});
