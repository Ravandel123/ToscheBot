import mongoose from 'mongoose';
import type { BackupDump } from './backup.js';

// Mirror of backup.ts (AUDIT.md §2.3): turns a posted dump file back into the
// live database. Every collection in the dump is wiped and re-inserted;
// collections that exist only in the database (created after the dump was
// taken) are dropped, so a restore yields the snapshot, never a merge. Dump
// collections are cleared with deleteMany rather than drop to keep their
// indexes — e.g. the unique {ownerId, instanceId} guard on items must hold
// the moment documents return.

const { EJSON } = mongoose.mongo.BSON;

// Exactly `Date#toISOString` output — the shape a BSON date was flattened to
// in pre-EJSON dumps (taken before 2026-07-07).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface RestoreReport {
   restored: { collection: string; documents: number }[];
   dropped: string[];
}

/**
 * Parses a backup file into a dump with real `Date`s. Current dumps are relaxed
 * EJSON (`serializeDump`), which round-trips dates losslessly. A legacy
 * plain-JSON dump is detected by the absent `$date` marker and has its ISO
 * strings revived by shape instead — safe here because every `_id` in this
 * project is a plain string, so dates are the only BSON type plain JSON ever
 * flattened. The pattern pass is skipped for EJSON dumps so a user-authored
 * string that merely looks like a date can never be corrupted into one.
 * Throws on anything that isn't a dump.
 */
export function parseBackupDump(text: string): BackupDump {
   const parsed: unknown = EJSON.parse(text, { relaxed: true });
   if (!isDump(parsed))
      throw new Error('Not a Tosche backup dump — expected { takenAt, collections: { name → documents[] } }.');

   if (!text.includes('"$date"'))
      reviveIsoDates(parsed.collections);
   return parsed;
}

/** Restores the connected database to the dump's snapshot. The caller owns
 *  connecting and confirming the target (see scripts/restore-backup.ts). */
export async function restoreBackupDump(dump: BackupDump): Promise<RestoreReport> {
   const db = mongoose.connection.db;
   if (!db)
      throw new Error('Not connected to a database — cannot restore.');

   const existing = (await db.listCollections().toArray()).map((info) => info.name);
   const dropped: string[] = [];
   for (const name of existing) {
      if (Object.hasOwn(dump.collections, name) || name.startsWith('system.'))
         continue;
      await db.collection(name).drop();
      dropped.push(name);
   }

   const restored: RestoreReport['restored'] = [];
   for (const [name, docs] of Object.entries(dump.collections)) {
      const collection = db.collection(name);
      await collection.deleteMany({});
      if (docs.length > 0)
         await collection.insertMany(docs as Record<string, unknown>[]);
      restored.push({ collection: name, documents: docs.length });
   }

   return { restored, dropped };
}

function isDump(value: unknown): value is BackupDump {
   if (typeof value !== 'object' || value === null)
      return false;
   const dump = value as Partial<BackupDump>;
   return typeof dump.takenAt === 'string'
      && typeof dump.collections === 'object' && dump.collections !== null
      && Object.values(dump.collections).every((docs) => Array.isArray(docs));
}

/** In-place walk converting ISO-timestamp strings back into `Date`s (the
 *  legacy-dump path only — see `parseBackupDump`). */
function reviveIsoDates(value: unknown): unknown {
   if (typeof value === 'string' && ISO_DATE.test(value))
      return new Date(value);
   if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++)
         value[i] = reviveIsoDates(value[i]);
      return value;
   }
   if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record))
         record[key] = reviveIsoDates(record[key]);
   }
   return value;
}
