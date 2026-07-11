import { createCanvas, loadImage } from '@napi-rs/canvas';

// Pure image-compositing seam (Ruleset/images.md §Compositing): a declarative
// CompositeSpec goes in, one flattened PNG buffer comes out. Callers build the
// spec from game state (a character's location anchor, equipped gear) and
// never touch pixels directly; a marked adapter uploads the buffer as a
// Discord attachment. Compositing needs a native rendering lib that may be
// absent on the host — callers must treat a thrown error as "compositing
// unavailable" and fall back to the base image (or text), per the
// always-optional image rule (images.md).

/** Anything @napi-rs/canvas can load: a file path, a URL, or raw bytes. */
export type ImageSource = string | Buffer | Uint8Array;

export interface Point {
   x: number;
   y: number;
}

export interface ImageLayer {
   kind: 'image';
   image: ImageSource;
   /** Top-left corner, in the base image's own pixel space (named anchors resolve to this upstream). */
   at: Point;
   width?: number;
   height?: number;
   /** 0–1, defaults to fully opaque. */
   opacity?: number;
}

export interface MarkerLayer {
   kind: 'marker';
   /** Center of the marker, in the base image's own pixel space. */
   at: Point;
   color: string;
   radius: number;
}

export type CompositeLayer = ImageLayer | MarkerLayer;

export interface CompositeSpec {
   base: ImageSource;
   layers: readonly CompositeLayer[];
}

function drawMarker(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, layer: MarkerLayer): void {
   ctx.globalAlpha = 1;
   ctx.fillStyle = layer.color;
   ctx.beginPath();
   ctx.arc(layer.at.x, layer.at.y, layer.radius, 0, Math.PI * 2);
   ctx.fill();
}

async function drawImageLayer(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, layer: ImageLayer): Promise<void> {
   const image = await loadImage(layer.image);
   ctx.globalAlpha = layer.opacity ?? 1;
   ctx.drawImage(image, layer.at.x, layer.at.y, layer.width ?? image.width, layer.height ?? image.height);
}

function solidSquare(size: number, color: string): Buffer {
   const canvas = createCanvas(size, size);
   const ctx = canvas.getContext('2d');

   ctx.fillStyle = color;
   ctx.fillRect(0, 0, size, size);
   return canvas.toBuffer('image/png');
}

/** Self-contained render with no checked-in art — proves the native canvas
 *  dependency actually works on whatever host runs it (`h!imagetest`,
 *  images.md Open questions: verify before relying on it). */
export async function renderSmokeTest(): Promise<Buffer> {
   return composite({
      base: solidSquare(200, '#1b2a41'),
      layers: [
         { kind: 'image', image: solidSquare(50, '#ffcc00'), at: { x: 20, y: 20 } },
         { kind: 'marker', at: { x: 150, y: 150 }, color: '#ff3333', radius: 14 },
      ],
   });
}

/** Renders a base image plus ordered overlays into one flattened PNG buffer. */
export async function composite(spec: CompositeSpec): Promise<Buffer> {
   const base = await loadImage(spec.base);
   const canvas = createCanvas(base.width, base.height);
   const ctx = canvas.getContext('2d');

   ctx.drawImage(base, 0, 0);

   for (const layer of spec.layers)
      switch (layer.kind) {
         case 'image':
            await drawImageLayer(ctx, layer);
            break;
         case 'marker':
            drawMarker(ctx, layer);
            break;
      }

   return canvas.toBuffer('image/png');
}
