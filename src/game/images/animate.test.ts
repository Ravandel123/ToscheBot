import { describe, expect, it } from 'vitest';
import { renderCardSpinGif, renderGif } from './animate.js';

const GIF_SIGNATURE = 'GIF89a';

describe('renderGif', () => {
   it('encodes a sequence of frames into a valid animated GIF', async () => {
      const gif = await renderGif([
         { base: { width: 20, height: 20, color: '#ff0000' }, layers: [] },
         { base: { width: 20, height: 20, color: '#00ff00' }, layers: [] },
         { base: { width: 20, height: 20, color: '#0000ff' }, layers: [] },
      ], { frameDelayMs: 40 });

      expect(gif.subarray(0, 6).toString('ascii')).toBe(GIF_SIGNATURE);
      expect(gif.length).toBeGreaterThan(0);
   });

   it('rejects an empty frame list', async () => {
      await expect(renderGif([])).rejects.toThrow();
   });
});

describe('renderCardSpinGif', () => {
   it('renders a small looping spin as a valid GIF (kept tiny for test speed)', async () => {
      const gif = await renderCardSpinGif(
         { rank: 'A', suit: 'spades' },
         { cardWidth: 30, framesPerTurn: 4, turns: 1, frameDelayMs: 50 },
      );

      expect(gif.subarray(0, 6).toString('ascii')).toBe(GIF_SIGNATURE);
   });
});
