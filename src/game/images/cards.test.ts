import { describe, expect, it } from 'vitest';
import { CARD_ASPECT_RATIO, CARD_RANKS, CARD_SUITS, renderCard, renderCardBack, renderHand } from './cards.js';
import { renderChip } from './chips.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(png: Buffer): { width: number; height: number } {
   return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('renderCard', () => {
   it('renders all 52 cards as valid PNGs', () => {
      for (const suit of CARD_SUITS)
         for (const rank of CARD_RANKS) {
            const png = renderCard({ rank, suit }, 80);
            expect(png.subarray(0, 8), `${rank} of ${suit}`).toEqual(PNG_SIGNATURE);
         }
   });

   it('sizes the card by width and the aspect ratio', () => {
      const png = renderCard({ rank: 'A', suit: 'spades' }, 100);

      expect(pngSize(png)).toEqual({ width: 100, height: Math.round(100 * CARD_ASPECT_RATIO) });
   });

   it('returns the cached buffer for a repeated card+size', () => {
      const first = renderCard({ rank: 'K', suit: 'clubs' }, 90);
      const second = renderCard({ rank: 'K', suit: 'clubs' }, 90);

      expect(second).toBe(first);
   });

   it('draws red and black suits differently', () => {
      const hearts = renderCard({ rank: '7', suit: 'hearts' }, 80);
      const spades = renderCard({ rank: '7', suit: 'spades' }, 80);

      expect(hearts.equals(spades)).toBe(false);
   });
});

describe('renderCardBack', () => {
   it('renders a valid PNG with card dimensions', () => {
      const png = renderCardBack(100);

      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      expect(pngSize(png)).toEqual({ width: 100, height: Math.round(100 * CARD_ASPECT_RATIO) });
   });
});

describe('renderHand', () => {
   it('lays cards out with the overlap offset', async () => {
      const png = await renderHand(
         [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }, 'face-down'],
         { cardWidth: 100, overlap: 0.5 },
      );

      // width + offset × (n − 1) = 100 + 50 × 2
      expect(pngSize(png)).toEqual({ width: 200, height: Math.round(100 * CARD_ASPECT_RATIO) });
   });

   it('rejects an empty hand', async () => {
      await expect(renderHand([])).rejects.toThrow();
   });
});

describe('renderChip', () => {
   it('renders a labeled chip as a valid square PNG', () => {
      const png = renderChip({ label: '25', width: 64 });

      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      expect(pngSize(png)).toEqual({ width: 64, height: 64 });
   });

   it('renders a blank chip without a label', () => {
      expect(renderChip().length).toBeGreaterThan(0);
   });
});
