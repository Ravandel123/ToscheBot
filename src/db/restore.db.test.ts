import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { buildBackupDump, serializeDump } from './backup.js';
import { parseBackupDump, restoreBackupDump } from './restore.js';
import { accountService } from './services/accountService.js';
import { characterService } from './services/characterService.js';
import { useTestDb } from '../testing/memoryDb.js';

// The restore is the backup's disaster-recovery mirror: it must reproduce the
// snapshot exactly — including BSON dates, which the regen job and the session
// TTL index query against — so it is only meaningful against a real database.
useTestDb();

const OWNER = '123456789012345678';

describe('parseBackupDump', () => {
   it('rejects a file that is not a dump', () => {
      expect(() => parseBackupDump('{"foo": 1}')).toThrow('Not a Tosche backup dump');
   });

   it('revives dates in a legacy plain-JSON dump', async () => {
      await characterService.create(OWNER, { name: 'Legacy', race: 'canid' });
      const legacyFile = JSON.stringify(await buildBackupDump()); // the pre-EJSON file format

      const dump = parseBackupDump(legacyFile);

      const [character] = dump.collections.characters as { createdAt: unknown }[];
      expect(character.createdAt).toBeInstanceOf(Date);
   });

   it('keeps user strings that merely look like dates intact in an EJSON dump', async () => {
      const notes = mongoose.connection.db!.collection<{ _id: string; text: string; at: Date }>('notes');
      await notes.insertOne({ _id: 'n1', text: '2026-01-01T00:00:00.000Z', at: new Date() });

      const dump = parseBackupDump(serializeDump(await buildBackupDump()));

      const [note] = dump.collections.notes as { text: unknown; at: unknown }[];
      expect(note.text).toBe('2026-01-01T00:00:00.000Z');
      expect(note.at).toBeInstanceOf(Date);
   });
});

describe('restoreBackupDump', () => {
   it('restores the snapshot: re-inserts lost documents, drops foreign collections', async () => {
      await accountService.getOrCreate(OWNER, 'Restorer');
      const character = await characterService.create(OWNER, { name: 'Restored', race: 'tamian' });
      const dump = parseBackupDump(serializeDump(await buildBackupDump()));

      // Diverge from the snapshot: lose the character, gain a foreign collection.
      const db = mongoose.connection.db!;
      await db.collection('characters').deleteMany({});
      await db.collection<{ _id: string }>('junk').insertOne({ _id: 'junk1' });

      const report = await restoreBackupDump(dump);

      const restored = await characterService.get(character._id);
      expect(restored?.identity.name).toBe('Restored');
      const names = (await db.listCollections().toArray()).map((info) => info.name);
      expect(names).not.toContain('junk');
      expect(report.dropped).toContain('junk');
      expect(report.restored).toContainEqual({ collection: 'characters', documents: 1 });

      // Dates must land as BSON dates again, not strings.
      const raw = await db.collection('characters').findOne();
      expect(raw?.createdAt).toBeInstanceOf(Date);
   });

   it('is idempotent — restoring twice yields the same state', async () => {
      await characterService.create(OWNER, { name: 'Twice', race: 'lutren' });
      const dump = parseBackupDump(serializeDump(await buildBackupDump()));

      await restoreBackupDump(dump);
      await restoreBackupDump(dump);

      expect(await mongoose.connection.db!.collection('characters').countDocuments()).toBe(1);
   });
});
