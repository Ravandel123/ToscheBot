import { describe, expect, it } from 'vitest';
import type { Message } from 'discord.js';
import { chunkMessage, targetFromArgs, MAX_MESSAGE_LENGTH } from './discord.js';

describe('chunkMessage', () => {
   it('returns a single chunk for short content', () => {
      expect(chunkMessage('hello')).toEqual(['hello']);
   });

   it('never produces a chunk longer than the limit', () => {
      const content = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
      for (const chunk of chunkMessage(content))
         expect(chunk.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
   });

   it('prefers to split on line boundaries', () => {
      const line = 'a'.repeat(1500);
      const chunks = chunkMessage(`${line}\n${line}`);
      expect(chunks).toEqual([line, line]);
   });

   it('hard-splits a single line that exceeds the limit', () => {
      const chunks = chunkMessage('x'.repeat(4500));
      expect(chunks).toHaveLength(3);
      expect(chunks.map((c) => c.length)).toEqual([2000, 2000, 500]);
   });
});

describe('targetFromArgs', () => {
   const fakeMessage = { author: { toString: () => '@author' } } as unknown as Message;

   it('returns the author mention when no args are given', () => {
      expect(targetFromArgs(fakeMessage, [])).toBe('@author');
   });

   it('returns the author mention for "me" and "i"', () => {
      expect(targetFromArgs(fakeMessage, ['me'])).toBe('@author');
      expect(targetFromArgs(fakeMessage, ['I'])).toBe('@author');
   });

   it('returns the joined free text otherwise', () => {
      expect(targetFromArgs(fakeMessage, ['the', 'Imperator'])).toBe('the Imperator');
   });
});
