import { describe, expect, it } from 'vitest';
import { dbNameFromUri } from './seed.js';

// Pure — the CLI's confirmation guard (seed-characters.ts) reads this to show
// and verify the target database name before ever connecting.
describe('dbNameFromUri', () => {
   it('extracts the database name from a standard connection string', () => {
      expect(dbNameFromUri('mongodb+srv://user:pass@cluster0.mongodb.net/tosche?retryWrites=true')).toBe('tosche');
   });

   it('extracts the database name with no query string', () => {
      expect(dbNameFromUri('mongodb://localhost:27017/tyril')).toBe('tyril');
   });

   it('reports a missing database name as "(default)"', () => {
      expect(dbNameFromUri('mongodb+srv://user:pass@cluster0.mongodb.net/')).toBe('(default)');
   });

   it('reports an unparseable string without throwing', () => {
      expect(dbNameFromUri('not a uri at all')).toBe('(unparseable connection string)');
   });
});
