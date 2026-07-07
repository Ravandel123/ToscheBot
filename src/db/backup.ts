import mongoose from 'mongoose';

// Disaster-recovery snapshot of the whole game database. Atlas M0 has NO
// backups, so until this existed the entire game state (characters players
// spent weeks building) was one bad wipe away from gone. The dump is
// `{ collection → documents[] }` serialized as relaxed EJSON (`serializeDump`),
// meant to be posted as a file to an owner-side channel (see jobs/dbBackup.ts)
// and re-imported by `npm run restore` (restore.ts is the mirror of this file).

const { EJSON } = mongoose.mongo.BSON;

export interface BackupDump {
   takenAt: string;
   collections: Record<string, unknown[]>;
}

/** Reads every collection of the connected database into one dump object.
 *  Collection order is stable (sorted) so consecutive dumps diff cleanly. */
export async function buildBackupDump(): Promise<BackupDump> {
   const db = mongoose.connection.db;
   if (!db)
      throw new Error('Not connected to a database — cannot build a backup.');

   const infos = await db.listCollections().toArray();
   const collections: Record<string, unknown[]> = {};

   for (const name of infos.map((info) => info.name).sort())
      collections[name] = await db.collection(name).find({}).toArray();

   return { takenAt: new Date().toISOString(), collections };
}

/** The posted file's format: relaxed EJSON — plain JSON except the BSON types
 *  plain JSON would flatten (dates become `{"$date": <ISO>}`), so a restore is
 *  lossless while the file stays human-readable and diffable. */
export function serializeDump(dump: BackupDump): string {
   return JSON.stringify(EJSON.serialize(dump, { relaxed: true }));
}

export function backupFileName(date = new Date()): string {
   return `tosche-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function documentCount(dump: BackupDump): number {
   return Object.values(dump.collections).reduce((sum, docs) => sum + docs.length, 0);
}
