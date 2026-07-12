import { describe, expect, it } from 'vitest';
import { RUMOR_INTROS, rumorPhrase } from './rumor.js';

describe('rumorPhrase', () => {
   it('always opens with an intro and closes a fully expanded sentence', () => {
      for (let i = 0; i < 50; i++) {
         const rumor = rumorPhrase();
         expect(RUMOR_INTROS.some((intro) => rumor.startsWith(`${intro} `))).toBe(true);
         expect(rumor).not.toContain('#');
         expect(rumor).toMatch(/\.$/);
      }
   });
});
