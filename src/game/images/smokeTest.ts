import { composite } from './composite.js';
import { renderCard, renderCardBack } from './cards.js';
import { renderChip } from './chips.js';
import { availableFontFamilies, defaultFontFamily } from './fonts.js';

// Self-contained render exercising every layer kind + the card/chip toolkit,
// with no checked-in art — proves the native canvas dependency AND font
// resolution actually work on whatever host runs it (`h!imagetest`; images.md:
// verify before relying on it). Re-run after any host change.

export interface SmokeTestReport {
   png: Buffer;
   renderMs: number;
   /** 0 means text layers render blank — drop a .ttf into assets/fonts/. */
   fontFamilyCount: number;
   /** What text layers will actually use ('DejaVu Sans' when the bundle registered). */
   fontFamily: string;
}

export async function renderSmokeTest(): Promise<SmokeTestReport> {
   const startedAt = Date.now();
   const png = await composite({
      base: { width: 460, height: 300, color: '#2d5a3d' },
      layers: [
         { kind: 'rect', at: { x: 16, y: 16 }, width: 428, height: 48, color: 'rgba(0, 0, 0, 0.35)', radius: 10 },
         { kind: 'text', text: 'Tosche compositing check', at: { x: 230, y: 40 }, size: 24, color: '#f4f1e8', bold: true, align: 'center', baseline: 'middle' },
         { kind: 'image', image: renderCard({ rank: 'A', suit: 'spades' }, 110), at: { x: 36, y: 96 } },
         { kind: 'image', image: renderCard({ rank: 'Q', suit: 'hearts' }, 110), at: { x: 160, y: 175 }, anchor: 'center', rotate: 8 },
         { kind: 'image', image: renderCardBack(110), at: { x: 235, y: 180 }, anchor: 'center', rotate: 16 },
         { kind: 'image', image: renderChip({ label: '25', width: 84 }), at: { x: 355, y: 150 }, anchor: 'center' },
         { kind: 'marker', at: { x: 410, y: 250 }, color: '#e74c3c', radius: 12, outline: { color: '#f4f1e8', width: 3 } },
         { kind: 'text', text: 'rect · text · image · rotation · marker', at: { x: 230, y: 284 }, size: 14, color: 'rgba(244, 241, 232, 0.8)', align: 'center' },
      ],
   });

   return {
      png,
      renderMs: Date.now() - startedAt,
      fontFamilyCount: availableFontFamilies().length,
      fontFamily: defaultFontFamily(),
   };
}
