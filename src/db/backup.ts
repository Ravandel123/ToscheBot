import mongoose from 'mongoose';

// Disaster-recovery snapshot of the whole game database. Atlas M0 has NO
// backups, so until this existed the entire game state (characters players
// spent weeks building) was one bad wipe away from gone. The dump is plain
// JSON — `{ collection → documents[] }` — meant to be posted as a file to an
// owner-side channel (see jobs/dbBackup.ts); restoring is a manual step
// (mongoimport, or a future restore script) and Dates land as ISO strings.

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

export function backupFileName(date = new Date()): string {
   return `tosche-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function documentCount(dump: BackupDump): number {
   return Object.values(dump.collections).reduce((sum, docs) => sum + docs.length, 0);
}
