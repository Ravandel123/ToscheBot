// Restores a database backup dump — the JSON file the daily `db-backup` job
// (or `h!backup`) posts to #espionage — into whatever `MONGODB_URI` resolves
// to (AUDIT.md §2.3): every collection is wiped and re-created from the dump,
// so the database ends up as the snapshot, never a merge. Run with:
//    npm run restore -- <path to tosche-backup-YYYY-MM-DD.json>
// (`ENV_FILE=.env.production npm run restore -- …` targets the live DB.) Like
// the seed, the target database name must be typed back before anything
// connects — or RESTORE_CONFIRM_DB=<name> when run non-interactively.
import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import type { BackupDump } from '../db/backup.js';
import { documentCount } from '../db/backup.js';
import { connectDb, disconnectDb } from '../db/connect.js';
import { parseBackupDump, restoreBackupDump } from '../db/restore.js';
import { confirmTargetDatabase } from './confirmDb.js';

const path = process.argv[2];
if (!path) {
   console.error('Usage: npm run restore -- <path to tosche-backup-*.json>');
   process.exit(1);
}

const dump = await readDump(path);
console.log(`Backup from ${dump.takenAt} — ${documentCount(dump)} documents:`);
for (const [name, docs] of Object.entries(dump.collections))
   console.log(`- ${name}: ${docs.length}`);

await confirmTargetDatabase(config.mongodbUri, { action: 'WIPE and restore', envVar: 'RESTORE_CONFIRM_DB' });
await connectDb(config.mongodbUri);

try {
   const report = await restoreBackupDump(dump);
   for (const { collection, documents } of report.restored)
      console.log(`Restored '${collection}' (${documents} documents).`);
   for (const name of report.dropped)
      console.log(`Dropped '${name}' — not in the dump.`);
   console.log('Restore complete. Start the bot normally; mongoose re-syncs indexes on startup.');
} finally {
   await disconnectDb();
}

async function readDump(file: string): Promise<BackupDump> {
   try {
      return parseBackupDump(await readFile(file, 'utf8'));
   } catch (error) {
      console.error(`Cannot read backup '${file}': ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
   }
}
