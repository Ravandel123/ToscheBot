// Runs the data migrations in migrations.ts against whatever `MONGODB_URI`
// resolves to. Every migration is idempotent, so a rerun is harmless. Run with:
// npm run migrate (ENV_FILE=.env.production to target the live DB). Take a
// backup first (`h!backup`) — a migration rewrites stored documents.
//
// Thin runnable shell: env → confirm → connect → migrate → disconnect.
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db/connect.js';
import { confirmTargetDatabase } from './confirmDb.js';
import { runMigrations } from './migrations.js';

// Same guard as the seed and restore scripts: the target database name must be
// typed back (or MIGRATE_CONFIRM_DB=<name> set non-interactively).
await confirmTargetDatabase(config.mongodbUri, { action: 'migrate', envVar: 'MIGRATE_CONFIRM_DB' });
await connectDb(config.mongodbUri);

try {
   const report = await runMigrations();
   for (const line of report.lines)
      console.log(line);
   console.log(`Done: ${report.modified} document(s) changed in total.`);
} finally {
   await disconnectDb();
}
