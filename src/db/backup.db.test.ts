import { describe, expect, it } from 'vitest';
import { backupFileName, buildBackupDump, documentCount, serializeDump } from './backup.js';
import { parseBackupDump } from './restore.js';
import { characterService } from './services/characterService.js';
import { accountService } from './services/accountService.js';
import { useTestDb } from '../testing/memoryDb.js';

// The backup is only meaningful against a real database: it must see every
// collection mongoose created and every document in them.
useTestDb();

describe('buildBackupDump', () => {
   it('dumps every collection with its documents', async () => {
      await accountService.getOrCreate('123456789012345678', 'Dumper');
      await characterService.create('123456789012345678', { name: 'Dumped', race: 'canid' });

      const dump = await buildBackupDump();

      expect(Object.keys(dump.collections)).toEqual(expect.arrayContaining(['accounts', 'characters']));
      expect(dump.collections.accounts).toHaveLength(1);
      expect(dump.collections.characters).toHaveLength(1);
      expect(documentCount(dump)).toBe(2);
      expect(new Date(dump.takenAt).getTime()).not.toBeNaN();
   });

   it('survives the file round trip losslessly (the posted file is restorable data)', async () => {
      await characterService.create('123456789012345678', { name: 'Roundtrip', race: 'tamian' });

      const dump = await buildBackupDump();
      const revived = parseBackupDump(serializeDump(dump));

      const characters = revived.collections.characters as { identity: { name: string }; createdAt: unknown }[];
      expect(characters[0].identity.name).toBe('Roundtrip');
      expect(characters[0].createdAt).toBeInstanceOf(Date); // EJSON keeps dates real across the file
   });
});

describe('backupFileName', () => {
   it('names the file by date', () => {
      expect(backupFileName(new Date('2026-07-06T12:00:00Z'))).toBe('tosche-backup-2026-07-06.json');
   });
});
