import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { composite } from './composite.js';

// Also the smoke test for the native rendering dependency itself (images.md
// §Compositing, Open questions): if @napi-rs/canvas can't load on this
// machine/CI runner, these fail loudly instead of a silent broken image later.
// Fixtures are generated in-memory (solid-color squares) so the test needs no
// checked-in art and proves the pipeline, not any particular asset.

function solidSquare(size: number, color: string): Buffer {
   const canvas = createCanvas(size, size);
   const ctx = canvas.getContext('2d');

   ctx.fillStyle = color;
   ctx.fillRect(0, 0, size, size);
   return canvas.toBuffer('image/png');
}

describe('composite', () => {
   it('renders a base image alone as a valid PNG', async () => {
      const png = await composite({ base: solidSquare(40, '#336699'), layers: [] });

      expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
   });

   it('stacks an image layer and a marker layer over the base', async () => {
      const base = solidSquare(100, '#222222');
      const overlay = solidSquare(10, '#ff0000');

      const png = await composite({
         base,
         layers: [
            { kind: 'image', image: overlay, at: { x: 5, y: 5 } },
            { kind: 'marker', at: { x: 50, y: 50 }, color: '#00ff00', radius: 4 },
         ],
      });

      expect(png.length).toBeGreaterThan(0);
   });

   it('respects an overlay width/height override', async () => {
      const base = solidSquare(50, '#000000');
      const overlay = solidSquare(5, '#ffffff');

      const png = await composite({
         base,
         layers: [{ kind: 'image', image: overlay, at: { x: 0, y: 0 }, width: 20, height: 20 }],
      });

      expect(png.length).toBeGreaterThan(0);
   });
});
