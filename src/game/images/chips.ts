import { createCanvas } from '@napi-rs/canvas';
import { defaultFontFamily } from './fonts.js';

// Programmatic casino-chip renderer (gambling-salon toolkit, D46/images.md):
// drawn like the cards — no art assets, replaceable via the asset catalog
// later. Not cached: the label is an arbitrary string (bet amounts), so a
// cache would grow unbounded; a chip is cheap to draw.

export interface ChipStyle {
   /** Text stamped in the middle (a value like '25'); omit for a blank chip. */
   label?: string;
   /** Chip body color. */
   color?: string;
   /** Diameter in px. */
   width?: number;
}

const DEFAULT_CHIP_COLOR = '#b3312f';
const DEFAULT_CHIP_WIDTH = 96;

/** Draws one poker chip (edge dashes + inner ring + optional label) into a transparent PNG. */
export function renderChip(style: ChipStyle = {}): Buffer {
   const width = style.width ?? DEFAULT_CHIP_WIDTH;
   const color = style.color ?? DEFAULT_CHIP_COLOR;
   const canvas = createCanvas(width, width);
   const ctx = canvas.getContext('2d');
   const center = width / 2;

   ctx.fillStyle = color;
   ctx.beginPath();
   ctx.arc(center, center, center - 1, 0, Math.PI * 2);
   ctx.fill();

   // Edge dashes — the classic alternating rim blocks.
   ctx.strokeStyle = '#f4f1e8';
   ctx.lineWidth = width * 0.09;
   ctx.setLineDash([width * 0.13, width * 0.13]);
   ctx.beginPath();
   ctx.arc(center, center, center - ctx.lineWidth / 2 - 1, 0, Math.PI * 2);
   ctx.stroke();
   ctx.setLineDash([]);

   ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
   ctx.lineWidth = Math.max(1, width * 0.02);
   ctx.beginPath();
   ctx.arc(center, center, width * 0.30, 0, Math.PI * 2);
   ctx.stroke();

   if (style.label) {
      ctx.fillStyle = '#f4f1e8';
      ctx.font = `bold ${Math.round(width * 0.26)}px "${defaultFontFamily()}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, center, center, width * 0.5);
   }

   return canvas.toBuffer('image/png');
}
