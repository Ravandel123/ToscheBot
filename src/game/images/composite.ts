import { createCanvas, loadImage, type Canvas, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { defaultFontFamily } from './fonts.js';

// Pure image-compositing seam (Ruleset/images.md §Compositing, D46): a
// declarative CompositeSpec goes in, one flattened PNG buffer comes out.
// Callers build the spec from game state (a character's location anchor, a
// dealt hand) and never touch pixels directly; a marked adapter uploads the
// buffer as a Discord attachment. A thrown error means "compositing
// unavailable" — callers catch and fall back to the base image (or text),
// per the always-optional image rule (images.md).

/** Anything @napi-rs/canvas can load: a file path, a URL, or raw bytes. */
export type ImageSource = string | Buffer | Uint8Array;

export interface Point {
   x: number;
   y: number;
}

/** A generated solid/transparent canvas — scenes need no base art to exist (images.md). */
export interface BlankBase {
   width: number;
   height: number;
   /** CSS color; omit for a fully transparent canvas. */
   color?: string;
}

export type CompositeBase = ImageSource | BlankBase;

export interface ImageLayer {
   kind: 'image';
   image: ImageSource;
   /** In the base's own pixel space (named anchors resolve to this upstream — assets.ts). */
   at: Point;
   width?: number;
   height?: number;
   /** Which point of the layer `at` pins (default 'top-left'). */
   anchor?: 'top-left' | 'center';
   /** Degrees clockwise around the anchor point. */
   rotate?: number;
   /** 0–1, defaults to fully opaque. */
   opacity?: number;
}

/** A generated dot — position readouts (map pins) before any marker art exists. */
export interface MarkerLayer {
   kind: 'marker';
   /** Center of the marker. */
   at: Point;
   color: string;
   radius: number;
   outline?: { color: string; width: number };
   opacity?: number;
}

export interface TextLayer {
   kind: 'text';
   text: string;
   at: Point;
   /** Font size in px. */
   size: number;
   color: string;
   /** Defaults to the bundled font (fonts.ts) so output matches across hosts. */
   family?: string;
   bold?: boolean;
   align?: 'left' | 'center' | 'right';
   baseline?: 'top' | 'middle' | 'alphabetic' | 'bottom';
   /** Squeezes wider text into this many px instead of overflowing. */
   maxWidth?: number;
   opacity?: number;
}

/** A filled (optionally rounded) rectangle — panels, nameplates, dim overlays. */
export interface RectLayer {
   kind: 'rect';
   /** Top-left corner. */
   at: Point;
   width: number;
   height: number;
   color: string;
   /** Corner radius in px. */
   radius?: number;
   opacity?: number;
}

export type CompositeLayer = ImageLayer | MarkerLayer | TextLayer | RectLayer;

export interface CompositeSpec {
   base: CompositeBase;
   layers: readonly CompositeLayer[];
}

function isBlankBase(base: CompositeBase): base is BlankBase {
   return typeof base === 'object' && !(base instanceof Uint8Array) && 'width' in base;
}

function drawImageLayer(ctx: SKRSContext2D, layer: ImageLayer, image: Image): void {
   const width = layer.width ?? image.width;
   const height = layer.height ?? image.height;

   ctx.globalAlpha = layer.opacity ?? 1;
   ctx.translate(layer.at.x, layer.at.y);
   if (layer.rotate)
      ctx.rotate((layer.rotate * Math.PI) / 180);
   if (layer.anchor === 'center')
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
   else
      ctx.drawImage(image, 0, 0, width, height);
}

function drawMarkerLayer(ctx: SKRSContext2D, layer: MarkerLayer): void {
   ctx.globalAlpha = layer.opacity ?? 1;
   ctx.fillStyle = layer.color;
   ctx.beginPath();
   ctx.arc(layer.at.x, layer.at.y, layer.radius, 0, Math.PI * 2);
   ctx.fill();
   if (!layer.outline)
      return;
   ctx.strokeStyle = layer.outline.color;
   ctx.lineWidth = layer.outline.width;
   ctx.stroke();
}

function drawTextLayer(ctx: SKRSContext2D, layer: TextLayer): void {
   ctx.globalAlpha = layer.opacity ?? 1;
   ctx.fillStyle = layer.color;
   ctx.font = `${layer.bold ? 'bold ' : ''}${layer.size}px "${layer.family ?? defaultFontFamily()}"`;
   ctx.textAlign = layer.align ?? 'left';
   ctx.textBaseline = layer.baseline ?? 'alphabetic';
   ctx.fillText(layer.text, layer.at.x, layer.at.y, layer.maxWidth);
}

function drawRectLayer(ctx: SKRSContext2D, layer: RectLayer): void {
   ctx.globalAlpha = layer.opacity ?? 1;
   ctx.fillStyle = layer.color;
   ctx.beginPath();
   ctx.roundRect(layer.at.x, layer.at.y, layer.width, layer.height, layer.radius ?? 0);
   ctx.fill();
}

/**
 * Draws a base (image or blank canvas) plus ordered overlays onto a fresh
 * Canvas. Exported for animate.ts, which needs raw pixels (`getImageData`)
 * per frame rather than an encoded PNG — everyone else should use
 * `composite()` below.
 */
export async function renderToCanvas(spec: CompositeSpec): Promise<Canvas> {
   // Load every raster up front so the draw pass below is synchronous.
   const layerImages = await Promise.all(spec.layers.map((layer) =>
      layer.kind === 'image' ? loadImage(layer.image) : Promise.resolve(null)));

   let canvas;
   if (isBlankBase(spec.base)) {
      canvas = createCanvas(spec.base.width, spec.base.height);
      if (spec.base.color) {
         const ctx = canvas.getContext('2d');
         ctx.fillStyle = spec.base.color;
         ctx.fillRect(0, 0, spec.base.width, spec.base.height);
      }
   } else {
      const baseImage = await loadImage(spec.base);
      canvas = createCanvas(baseImage.width, baseImage.height);
      canvas.getContext('2d').drawImage(baseImage, 0, 0);
   }

   const ctx = canvas.getContext('2d');
   spec.layers.forEach((layer, index) => {
      ctx.save();
      switch (layer.kind) {
         case 'image':
            // The parallel array holds an Image exactly at image-layer indices.
            drawImageLayer(ctx, layer, layerImages[index] as Image);
            break;
         case 'marker':
            drawMarkerLayer(ctx, layer);
            break;
         case 'text':
            drawTextLayer(ctx, layer);
            break;
         case 'rect':
            drawRectLayer(ctx, layer);
            break;
      }
      ctx.restore();
   });

   return canvas;
}

/** Renders a base (image or blank canvas) plus ordered overlays into one flattened PNG. */
export async function composite(spec: CompositeSpec): Promise<Buffer> {
   const canvas = await renderToCanvas(spec);
   return canvas.toBuffer('image/png');
}
