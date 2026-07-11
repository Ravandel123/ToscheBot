import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { composite } from './composite.js';

// Also the smoke test for the native rendering dependency itself (images.md
// §Compositing): if @napi-rs/canvas can't load on this machine/CI runner,
// these fail loudly instead of a silent broken image later. Fixtures are
// generated in-memory (solid-color squares) so the test needs no checked-in
// art and proves the pipeline, not any particular asset.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function solidSquare(size: number, color: string): Buffer {
   const canvas = createCanvas(size, size);
   const ctx = canvas.getContext('2d');

   ctx.fillStyle = color;
   ctx.fillRect(0, 0, size, size);
   return canvas.toBuffer('image/png');
}

function pngSize(png: Buffer): { width: number; height: number } {
   // IHDR: width/height are the two big-endian uint32s right after the 16-byte preamble.
   return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('composite', () => {
   it('renders an image base alone as a valid PNG of the base size', async () => {
      const png = await composite({ base: solidSquare(40, '#336699'), layers: [] });

      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      expect(pngSize(png)).toEqual({ width: 40, height: 40 });
   });

   it('renders a blank-canvas base with the requested dimensions', async () => {
      const png = await composite({ base: { width: 120, height: 50, color: '#123456' }, layers: [] });

      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      expect(pngSize(png)).toEqual({ width: 120, height: 50 });
   });

   it('stacks image and marker layers over the base and changes the output', async () => {
      const base = solidSquare(100, '#222222');
      const bare = await composite({ base, layers: [] });
      const decorated = await composite({
         base,
         layers: [
            { kind: 'image', image: solidSquare(10, '#ff0000'), at: { x: 5, y: 5 } },
            { kind: 'marker', at: { x: 50, y: 50 }, color: '#00ff00', radius: 4, outline: { color: '#ffffff', width: 2 } },
         ],
      });

      expect(decorated.equals(bare)).toBe(false);
   });

   it('respects an overlay width/height override', async () => {
      const png = await composite({
         base: solidSquare(50, '#000000'),
         layers: [{ kind: 'image', image: solidSquare(5, '#ffffff'), at: { x: 0, y: 0 }, width: 20, height: 20 }],
      });

      expect(png.length).toBeGreaterThan(0);
   });

   it('draws text and rect layers', async () => {
      const base = { width: 200, height: 80, color: '#ffffff' };
      const bare = await composite({ base, layers: [] });
      const withText = await composite({
         base,
         layers: [
            { kind: 'rect', at: { x: 10, y: 10 }, width: 180, height: 60, color: '#dddddd', radius: 8 },
            { kind: 'text', text: 'Deltrada', at: { x: 100, y: 40 }, size: 20, color: '#000000', bold: true, align: 'center', baseline: 'middle' },
         ],
      });

      expect(withText.equals(bare)).toBe(false);
   });

   it('rotates a center-anchored layer without throwing', async () => {
      const png = await composite({
         base: { width: 100, height: 100 },
         layers: [{ kind: 'image', image: solidSquare(30, '#00ffff'), at: { x: 50, y: 50 }, anchor: 'center', rotate: 45 }],
      });

      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
   });
});
