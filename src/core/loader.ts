import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function isLoadableFile(name: string): boolean {
   // `_`-prefixed files are loader-invisible helpers/data colocated with
   // commands; `*.test`/`*.spec` are unit tests. `.js` is accepted so a
   // compiled `dist/` run keeps working.
   if (name.startsWith('_') || name.endsWith('.d.ts') || /\.(test|spec)\.[jt]s$/.test(name))
      return false;

   return name.endsWith('.ts') || name.endsWith('.js');
}

/**
 * Recursively imports every module under `rootDir` and returns their default
 * exports. A missing directory yields an empty list; a loadable file without
 * a default export throws — a malformed module is a deploy error and must
 * fail at startup, not at first use.
 */
export async function loadDefaultExports<T>(rootDir: string): Promise<T[]> {
   let entries;
   try {
      entries = await readdir(rootDir, { withFileTypes: true, recursive: true });
   } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
         return [];

      throw error;
   }

   const results: T[] = [];

   for (const entry of entries) {
      if (!entry.isFile() || !isLoadableFile(entry.name))
         continue;

      // `_`-prefixed DIRECTORIES are loader-invisible too, so a colocated
      // helper folder can't leak normally-named files into the registry.
      const relativeDir = path.relative(rootDir, entry.parentPath);
      if (relativeDir.split(path.sep).some((segment) => segment.startsWith('_')))
         continue;

      const filePath = path.join(entry.parentPath, entry.name);
      const module: unknown = await import(pathToFileURL(filePath).href);

      if (typeof module !== 'object' || module === null || !('default' in module) || module.default === undefined)
         throw new Error(`Module '${filePath}' has no default export.`);

      results.push(module.default as T);
   }

   return results;
}
