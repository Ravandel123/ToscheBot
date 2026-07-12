import { describe, expect, it } from 'vitest';
import { bold, italic, underline, capitalize } from './text.js';

describe('text helpers', () => {
   it('wraps with markdown', () => {
      expect(bold('x')).toBe('**x**');
      expect(italic('x')).toBe('*x*');
      expect(underline('x')).toBe('__x__');
   });

   it('capitalizes the first letter and leaves the rest', () => {
      expect(capitalize('hello world')).toBe('Hello world');
   });

   it('handles an empty string', () => {
      expect(capitalize('')).toBe('');
   });
});
