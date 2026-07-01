import { describe, expect, it } from 'vitest';
import { findBannedWord } from './bannedWords.js';

describe('findBannedWord', () => {
   it('returns null for clean text', () => {
      expect(findBannedWord('hail the Imperator, general')).toBeNull();
   });

   it('catches a plain banned word and reports where it matched', () => {
      const match = findBannedWord('you absolute dick');
      expect(match?.term).toBe('dick');
      expect(match?.matchedText).toBe('dick');
      expect(match?.index).toBe(13);
      expect(match?.viaCollapsed).toBe(false);
   });

   it('catches a punctuation-evaded word and flags the collapsed match', () => {
      const match = findBannedWord('f.u.c.k this');
      expect(match?.term).toBe('fuck');
      expect(match?.matchedText).toBe('f.u.c.k'); // spans the original punctuation
      expect(match?.viaCollapsed).toBe(true);
   });

   it('catches a banned domain', () => {
      expect(findBannedWord('check furaffinity.net/whatever')?.term).toBe('furaffinity.net');
   });
});
