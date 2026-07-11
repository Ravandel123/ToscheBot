import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';
import { log } from '../../lib/log.js';

// Text rendering needs a font, and a bare Linux container may ship NONE — so
// the repo bundles DejaVu Sans (assets/fonts/, free Bitstream Vera license)
// and registers it lazily on first use. Bundling also pins one identical face
// across dev (Windows), CI and the host, so a composite renders the same
// everywhere instead of falling back to whatever the OS has.

const FONTS_DIR = fileURLToPath(new URL('../../../assets/fonts', import.meta.url));

/** Family name inside the bundled TTFs — what `assets/fonts/DejaVuSans*.ttf` register as. */
const BUNDLED_FONT_FAMILY = 'DejaVu Sans';

let registered = false;

/** Registers every font in assets/fonts once; safe to call repeatedly. */
export function ensureFontsRegistered(): void {
   if (registered)
      return;
   registered = true;
   if (!existsSync(FONTS_DIR)) {
      log.warn('assets/fonts is missing — text layers fall back to system fonts (may be none).');
      return;
   }
   GlobalFonts.loadFontsFromDir(FONTS_DIR);
   if (!GlobalFonts.has(BUNDLED_FONT_FAMILY))
      log.warn(`Bundled font '${BUNDLED_FONT_FAMILY}' failed to register from assets/fonts.`);
}

/**
 * The family text layers use unless told otherwise: the bundled face when it
 * registered (identical output on every host), else the system default.
 */
export function defaultFontFamily(): string {
   ensureFontsRegistered();
   return GlobalFonts.has(BUNDLED_FONT_FAMILY) ? BUNDLED_FONT_FAMILY : 'sans-serif';
}

/** Every font family the renderer can currently resolve (diagnostics — `h!imagetest`). */
export function availableFontFamilies(): string[] {
   ensureFontsRegistered();
   return GlobalFonts.families.map((entry) => entry.family);
}
