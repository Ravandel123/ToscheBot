import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { composite, type ImageLayer } from './composite.js';
import { defaultFontFamily } from './fonts.js';

// Programmatic playing-card renderer for the future gambling salon: every
// card is DRAWN (vector shapes + the bundled font), no art assets required —
// the salon is fully playable with zero images (images.md's always-optional
// rule) and card art can replace this via the asset catalog later. Rendering
// only: deck building/shuffling/game rules belong to the salon's own module.

export const CARD_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type CardSuit = (typeof CARD_SUITS)[number];

export const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type CardRank = (typeof CARD_RANKS)[number];

export interface PlayingCard {
   rank: CardRank;
   suit: CardSuit;
}

/** A card in a rendered hand: face-up, or the back. */
export type HandCard = PlayingCard | 'face-down';

export const CARD_ASPECT_RATIO = 1.4;
const DEFAULT_CARD_WIDTH = 140;

const CARD_FACE_COLOR = '#fbf9f2';
const CARD_EDGE_COLOR = '#b9b4a4';
const RED_SUIT_COLOR = '#c8102e';
const BLACK_SUIT_COLOR = '#20242e';
const BACK_COLOR = '#274472';
const BACK_PATTERN_COLOR = 'rgba(255, 255, 255, 0.30)';

function suitColor(suit: CardSuit): string {
   return suit === 'hearts' || suit === 'diamonds' ? RED_SUIT_COLOR : BLACK_SUIT_COLOR;
}

/** Heart outline path in a box centered on (cx, cy), `size` px tall. */
function traceHeart(ctx: SKRSContext2D, cx: number, cy: number, size: number): void {
   const w = size * 1.1;
   const h = size;
   const x = cx - w / 2;
   const y = cy - h / 2;

   ctx.moveTo(x + w / 2, y + h * 0.35);
   ctx.bezierCurveTo(x + w / 2, y + h * 0.27, x + w * 0.4, y, x + w * 0.25, y);
   ctx.bezierCurveTo(x, y, x, y + h * 0.3, x, y + h * 0.3);
   ctx.bezierCurveTo(x, y + h * 0.55, x + w * 0.2, y + h * 0.77, x + w / 2, y + h);
   ctx.bezierCurveTo(x + w * 0.8, y + h * 0.77, x + w, y + h * 0.55, x + w, y + h * 0.3);
   ctx.bezierCurveTo(x + w, y + h * 0.3, x + w, y, x + w * 0.75, y);
   ctx.bezierCurveTo(x + w * 0.6, y, x + w / 2, y + h * 0.27, x + w / 2, y + h * 0.35);
}

/** Flared stem shared by spades and clubs, from the glyph center down. */
function traceStem(ctx: SKRSContext2D, cx: number, cy: number, size: number): void {
   ctx.moveTo(cx, cy + size * 0.05);
   ctx.quadraticCurveTo(cx - size * 0.06, cy + size * 0.32, cx - size * 0.18, cy + size * 0.5);
   ctx.lineTo(cx + size * 0.18, cy + size * 0.5);
   ctx.quadraticCurveTo(cx + size * 0.06, cy + size * 0.32, cx, cy + size * 0.05);
}

/** Fills a suit glyph centered on (cx, cy), `size` px tall, in the current fillStyle. */
function drawSuit(ctx: SKRSContext2D, suit: CardSuit, cx: number, cy: number, size: number): void {
   ctx.beginPath();
   switch (suit) {
      case 'hearts':
         traceHeart(ctx, cx, cy, size);
         break;
      case 'diamonds':
         ctx.moveTo(cx, cy - size / 2);
         ctx.lineTo(cx + size * 0.38, cy);
         ctx.lineTo(cx, cy + size / 2);
         ctx.lineTo(cx - size * 0.38, cy);
         ctx.closePath();
         break;
      case 'spades':
         // A heart flipped upside down (lobes at the bottom), plus a stem.
         ctx.save();
         ctx.translate(cx, cy - size * 0.08);
         ctx.scale(1, -1);
         traceHeart(ctx, 0, 0, size * 0.8);
         ctx.restore();
         traceStem(ctx, cx, cy, size);
         break;
      case 'clubs': {
         // Each lobe is its own subpath (moveTo first) — chaining arcs draws
         // connecting lines that notch the fill.
         const lobe = size * 0.26;
         ctx.moveTo(cx + lobe, cy - size * 0.22);
         ctx.arc(cx, cy - size * 0.22, lobe, 0, Math.PI * 2);
         ctx.moveTo(cx - size * 0.23 + lobe, cy + size * 0.02);
         ctx.arc(cx - size * 0.23, cy + size * 0.02, lobe, 0, Math.PI * 2);
         ctx.moveTo(cx + size * 0.23 + lobe, cy + size * 0.02);
         ctx.arc(cx + size * 0.23, cy + size * 0.02, lobe, 0, Math.PI * 2);
         traceStem(ctx, cx, cy, size);
         break;
      }
   }
   ctx.fill();
}

function drawCardBlank(ctx: SKRSContext2D, width: number, height: number): void {
   const radius = width * 0.09;

   ctx.fillStyle = CARD_FACE_COLOR;
   ctx.beginPath();
   ctx.roundRect(0, 0, width, height, radius);
   ctx.fill();
   ctx.strokeStyle = CARD_EDGE_COLOR;
   ctx.lineWidth = Math.max(1, width * 0.015);
   ctx.stroke();
}

const cardCache = new Map<string, Buffer>();

/**
 * Draws one card face (minimalist: corner rank + suit, big center suit) into
 * a PNG. Deterministic per (card, width), so results are cached — a card
 * table re-renders the same faces constantly.
 */
export function renderCard(card: PlayingCard, width = DEFAULT_CARD_WIDTH): Buffer {
   const cacheKey = `${card.rank}:${card.suit}:${width}`;
   const cached = cardCache.get(cacheKey);
   if (cached)
      return cached;

   const height = Math.round(width * CARD_ASPECT_RATIO);
   const canvas = createCanvas(width, height);
   const ctx = canvas.getContext('2d');

   drawCardBlank(ctx, width, height);

   const color = suitColor(card.suit);
   const drawCorner = (): void => {
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(width * 0.2)}px "${defaultFontFamily()}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(card.rank, width * 0.16, height * 0.045, width * 0.26);
      drawSuit(ctx, card.suit, width * 0.16, height * 0.26, width * 0.16);
   };

   drawCorner();
   ctx.save();
   ctx.translate(width, height);
   ctx.rotate(Math.PI);
   drawCorner();
   ctx.restore();

   ctx.fillStyle = color;
   drawSuit(ctx, card.suit, width / 2, height * 0.58, width * 0.52);

   const png = canvas.toBuffer('image/png');
   cardCache.set(cacheKey, png);
   return png;
}

/** Draws the shared card back (lattice pattern) — face-down cards. Cached like faces. */
export function renderCardBack(width = DEFAULT_CARD_WIDTH): Buffer {
   const cacheKey = `back:${width}`;
   const cached = cardCache.get(cacheKey);
   if (cached)
      return cached;

   const height = Math.round(width * CARD_ASPECT_RATIO);
   const canvas = createCanvas(width, height);
   const ctx = canvas.getContext('2d');

   drawCardBlank(ctx, width, height);

   const inset = width * 0.08;
   ctx.beginPath();
   ctx.roundRect(inset, inset, width - inset * 2, height - inset * 2, width * 0.05);
   ctx.fillStyle = BACK_COLOR;
   ctx.fill();
   ctx.clip();

   ctx.strokeStyle = BACK_PATTERN_COLOR;
   ctx.lineWidth = Math.max(1, width * 0.012);
   const step = width * 0.12;
   for (let offset = -height; offset < width + height; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + height, height);
      ctx.moveTo(offset + height, 0);
      ctx.lineTo(offset, height);
      ctx.stroke();
   }

   const png = canvas.toBuffer('image/png');
   cardCache.set(cacheKey, png);
   return png;
}

export interface RenderHandOptions {
   cardWidth?: number;
   /** Fraction of a card's width each next card is offset by (0.45 ≈ poker fan). */
   overlap?: number;
}

/** Renders a spread of cards (face-up or face-down) into one transparent PNG. */
export async function renderHand(cards: readonly HandCard[], options: RenderHandOptions = {}): Promise<Buffer> {
   if (cards.length === 0)
      throw new Error('renderHand needs at least one card.');

   const cardWidth = options.cardWidth ?? DEFAULT_CARD_WIDTH;
   const cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO);
   const offset = Math.round(cardWidth * (options.overlap ?? 0.45));

   const layers = cards.map((card, index): ImageLayer => ({
      kind: 'image',
      image: card === 'face-down' ? renderCardBack(cardWidth) : renderCard(card, cardWidth),
      at: { x: index * offset, y: 0 },
   }));

   return composite({
      base: { width: cardWidth + offset * (cards.length - 1), height: cardHeight },
      layers,
   });
}
