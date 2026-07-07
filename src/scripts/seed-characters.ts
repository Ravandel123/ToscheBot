// Rebuilds the alpha roster after a DB wipe: replays each player's creation
// inputs from seed-data.ts through the NORMAL domain services (in seed.ts), so
// the resulting documents always match the current schema (CLAUDE.md D38).
// Idempotent — an already-existing owner+name pair is skipped, so rerun freely
// after adding entries. Run with: npm run seed (optionally `ENV_FILE=.env.production
// npm run seed` to target the live DB — see the confirmation guard below).
//
// This file is the thin runnable shell: env → connect → validated seed →
// disconnect. All reusable logic lives in seed.ts (no `config` import there) so
// it stays testable against an in-memory DB.
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db/connect.js';
import { CharacterLockManager } from '../core/locks.js';
import { confirmTargetDatabase } from './confirmDb.js';
import { SEED_CHARACTERS } from './seed-data.js';
import { runSeed, validateRoster } from './seed.js';

if (SEED_CHARACTERS.length === 0) {
   console.log('seed-data.ts has no entries — add characters to SEED_CHARACTERS first.');
   process.exit(0);
}

const problems = validateRoster(SEED_CHARACTERS);
if (problems.length > 0) {
   console.error(`Seed data invalid — nothing was written:\n- ${problems.join('\n- ')}`);
   process.exit(1);
}

// A wipe-recovery script writing to whatever `MONGODB_URI` resolves to must
// never run "by accident" — the shared guard (confirmDb.ts) requires the
// target database name typed back (or SEED_CONFIRM_DB=<name> non-interactively).
await confirmTargetDatabase(config.mongodbUri, { action: 'continue seeding', envVar: 'SEED_CONFIRM_DB' });
await connectDb(config.mongodbUri);

try {
   const report = await runSeed(SEED_CHARACTERS, new CharacterLockManager());
   for (const line of report.lines)
      console.log(line);
   console.log(`Done: ${report.created} created, ${report.skipped} skipped (of ${SEED_CHARACTERS.length} entries).`);
} finally {
   await disconnectDb();
}
