import { createCanvas, GifDisposal, GifEncoder, loadImage } from '@napi-rs/canvas';
import { renderCard, renderCardBack, type PlayingCard } from './cards.js';
import { renderToCanvas, type CompositeSpec } from './composite.js';

// Looping GIF rendering (extends D46/D47's still-image compositing): for a
// real animation (a spin, a reveal), encode it ONCE as a GIF rather than
// rerendering + editing a message on a timer — no rate-limit risk, no
// re-upload per frame, and Discord plays it natively. `@napi-rs/canvas`
// ships its own multi-frame GifEncoder; this module is the only place that
// touches it.
//
// GIF frames are NOT independently opaque by default: the default disposal
// (`Keep`) leaves a transparent pixel showing whatever the PREVIOUS frame
// drew there, so a shrinking/moving subject on a transparent canvas smears
// into a multi-exposure ghost trail across the loop. Every `addFrame` here
// sets `disposal: Background` (clear before the next frame) — belt-and-braces
// with also drawing an opaque background per frame, since a fully opaque
// frame has no transparent pixels for any disposal mode to mishandle.

export interface GifOptions {
   /** Milliseconds each frame holds. */
   frameDelayMs?: number;
   /** 0 = loop forever (default). */
   repeat?: number;
   /** NeuQuant color-quantization quality, 1 (best/slowest) – 30 (worst/fastest). */
   quality?: number;
}

const DEFAULT_FRAME_DELAY_MS = 60;
const DEFAULT_QUALITY = 10;

/**
 * Encodes a sequence of composite specs (all the same size) into one animated
 * GIF. Give every spec a fully OPAQUE base (an image, or `BlankBase` with a
 * `color`) — a transparent region will ghost previous frames through it (see
 * the module doc comment).
 */
export async function renderGif(frames: readonly CompositeSpec[], options: GifOptions = {}): Promise<Buffer> {
   if (frames.length === 0)
      throw new Error('renderGif needs at least one frame.');

   const canvases = await Promise.all(frames.map((spec) => renderToCanvas(spec)));
   const [{ width, height }] = canvases;

   const encoder = new GifEncoder(width, height, {
      repeat: options.repeat ?? 0,
      quality: options.quality ?? DEFAULT_QUALITY,
   });
   for (const canvas of canvases) {
      const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
      encoder.addFrame(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width, height, {
         delay: options.frameDelayMs ?? DEFAULT_FRAME_DELAY_MS,
         disposal: GifDisposal.Background,
      });
   }
   return encoder.finish();
}

export interface CardSpinOptions extends GifOptions {
   cardWidth?: number;
   /** Frames per full 360° turn — higher = smoother, slower to encode. */
   framesPerTurn?: number;
   /** How many full turns the loop makes. */
   turns?: number;
   /** Opaque fill behind the card every frame — defaults to felt green, never omitted (see module doc comment). */
   backgroundColor?: string;
}

const DEFAULT_FRAMES_PER_TURN = 24;
const DEFAULT_SPIN_BACKGROUND_COLOR = '#1e4d2b';

/**
 * A card spinning in place on its vertical axis, flashing face/back as it
 * turns edge-on — the `h!imagetest gif` demo and a reusable "reveal" beat for
 * the future gambling salon (dealing/flipping a card).
 */
export async function renderCardSpinGif(card: PlayingCard, options: CardSpinOptions = {}): Promise<Buffer> {
   const cardWidth = options.cardWidth ?? 140;
   const cardHeight = Math.round(cardWidth * 1.4);
   const framesPerTurn = options.framesPerTurn ?? DEFAULT_FRAMES_PER_TURN;
   const turns = options.turns ?? 1;
   const padding = Math.round(cardWidth * 0.15);
   const canvasWidth = cardWidth + padding * 2;
   const canvasHeight = cardHeight + padding * 2;

   const [faceImage, backImage] = await Promise.all([
      loadImage(renderCard(card, cardWidth)),
      loadImage(renderCardBack(cardWidth)),
   ]);

   const totalFrames = framesPerTurn * turns;
   const encoder = new GifEncoder(canvasWidth, canvasHeight, {
      repeat: options.repeat ?? 0,
      quality: options.quality ?? DEFAULT_QUALITY,
   });

   for (let frame = 0; frame < totalFrames; frame++) {
      const angle = (frame / framesPerTurn) * Math.PI * 2;
      // cos(angle) shrinks the card to a sliver edge-on and flips sign past
      // 90°/270° — exactly where a real card would show its other face.
      const scaleX = Math.cos(angle);
      const showingBack = scaleX < 0;

      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = options.backgroundColor ?? DEFAULT_SPIN_BACKGROUND_COLOR;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.save();
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.scale(Math.max(Math.abs(scaleX), 0.03), 1);
      ctx.drawImage(showingBack ? backImage : faceImage, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      ctx.restore();

      const { data } = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      encoder.addFrame(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), canvasWidth, canvasHeight, {
         delay: options.frameDelayMs ?? DEFAULT_FRAME_DELAY_MS,
         disposal: GifDisposal.Background,
      });
   }

   return encoder.finish();
}
