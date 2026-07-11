import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../../lib/log.js';
import type { Point } from './composite.js';

// Catalog of repo-committed art under assets/images/ (D46: anything the bot's
// own renderer draws ON ships with the code — the render path never depends
// on a network fetch). D10 applied to files: stable ids here, resolved to
// paths at render time, so stored docs never hold filenames and re-pointing
// art is a catalog edit. `anchors` are named points in the image's own pixel
// space (a map's locations, a board's squares) so game code places overlays
// in game terms ("at the plaza") and an art re-draw only re-maps this table.

export interface ImageAssetDefinition {
   /** Path relative to assets/images/. */
   file: string;
   /** Named coordinate anchors in this image's pixel space. */
   anchors?: Readonly<Record<string, Point>>;
}

export const IMAGE_ASSETS = {
   // No art yet — the first real entry is the location map (images.md), e.g.:
   // deltradaMap: { file: 'maps/deltrada.png', anchors: { plaza: { x: 320, y: 210 } } },
} as const satisfies Record<string, ImageAssetDefinition>;

export type ImageAssetId = keyof typeof IMAGE_ASSETS;

const IMAGES_DIR = fileURLToPath(new URL('../../../assets/images', import.meta.url));

// Widened view for tolerant string lookups (unknown ids must degrade, not crash).
const CATALOG: Record<string, ImageAssetDefinition> = IMAGE_ASSETS;

export interface ResolvedImageAsset {
   /** Absolute path — usable directly as a composite base or image-layer source. */
   path: string;
   anchors: Readonly<Record<string, Point>>;
}

/**
 * Resolves a catalog id to on-disk art. Unknown id or a missing file logs and
 * returns null — images are optional everywhere (images.md), so the caller
 * renders text-only / base-only instead of failing.
 */
export function imageAsset(id: string): ResolvedImageAsset | null {
   const definition: ImageAssetDefinition | undefined = CATALOG[id];
   if (!definition) {
      log.warn(`Unknown image asset id '${id}' — rendering without it.`);
      return null;
   }
   const path = join(IMAGES_DIR, definition.file);
   if (!existsSync(path)) {
      log.warn(`Image asset '${id}' points to a missing file: ${definition.file}`);
      return null;
   }
   return { path, anchors: definition.anchors ?? {} };
}
