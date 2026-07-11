import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { IMAGE_ASSETS, imageAsset, type ImageAssetDefinition } from './assets.js';
import { defaultFontFamily } from './fonts.js';

describe('IMAGE_ASSETS catalog', () => {
   // Catalog-integrity check in the locations-graph style: an id must never
   // point at art that didn't ship with the deploy.
   it('every entry resolves to a committed file', () => {
      const imagesDir = fileURLToPath(new URL('../../../assets/images', import.meta.url));
      for (const [id, definition] of Object.entries<ImageAssetDefinition>(IMAGE_ASSETS))
         expect(existsSync(join(imagesDir, definition.file)), `asset '${id}' → ${definition.file}`).toBe(true);
   });
});

describe('imageAsset', () => {
   it('returns null and logs for an unknown id instead of throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(imageAsset('no-such-asset')).toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
   });
});

describe('fonts', () => {
   it('registers the bundled DejaVu Sans so text renders identically on every host', () => {
      expect(defaultFontFamily()).toBe('DejaVu Sans');
   });
});
