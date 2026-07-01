import { describe, expect, it } from 'vitest';
import { isHttpUrl } from './identity.js';

describe('isHttpUrl', () => {
   it('accepts http and https links', () => {
      expect(isHttpUrl('https://example.com/a.png')).toBe(true);
      expect(isHttpUrl('http://example.com/a.png')).toBe(true);
   });

   it('rejects empty, undefined, and non-http values', () => {
      expect(isHttpUrl('')).toBe(false);
      expect(isHttpUrl(undefined)).toBe(false);
      expect(isHttpUrl('ftp://example.com/a.png')).toBe(false);
      expect(isHttpUrl('not a url')).toBe(false);
      expect(isHttpUrl('javascript:alert(1)')).toBe(false);
   });
});
