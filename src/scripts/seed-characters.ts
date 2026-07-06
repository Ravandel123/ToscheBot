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
import { SEED_CHARACTERS } from './seed-data.js';
import { dbNameFromUri, runSeed, validateRoster } from './seed.js';

if (SEED_CHARACTERS.length === 0) {
   console.log('seed-data.ts has no entries — add characters to SEED_CHARACTERS first.');
   process.exit(0);
}

const problems = validateRoster(SEED_CHARACTERS);
if (problems.length > 0) {
   console.error(`Seed data invalid — nothing was written:\n- ${problems.join('\n- ')}`);
   process.exit(1);
}

await confirmTargetDatabase();
await connectDb(config.mongodbUri);

try {
   const report = await runSeed(SEED_CHARACTERS, new CharacterLockManager());
   for (const line of report.lines)
      console.log(line);
   console.log(`Done: ${report.created} created, ${report.skipped} skipped (of ${SEED_CHARACTERS.length} entries).`);
} finally {
   await disconnectDb();
}

/**
 * A wipe-recovery script writing to whatever `MONGODB_URI` resolves to is exactly
 * the kind of action that must never happen "by accident" (e.g. a stray
 * `ENV_FILE=.env.production`, or a future Claude session rerunning this without
 * this conversation's context). Prints the target database name up front and
 * requires it to be confirmed before any connection is made:
 *  - interactive terminal: type the database name back:
 *  - non-interactive (scripts, CI, an agent's shell): set SEED_CONFIRM_DB=<name>
 *    explicitly — there is no way to proceed blindly.
 */
async function confirmTargetDatabase(): Promise<void> {
   const dbName = dbNameFromUri(config.mongodbUri);
   const redactedUri = config.mongodbUri.replace(/:\/\/[^@]*@/, '://***@');
   console.log(`Target database: '${dbName}' (${redactedUri})`);

   if (process.stdin.isTTY) {
      const { createInterface } = await import('node:readline/promises');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(`Type the database name to continue seeding '${dbName}': `);
      rl.close();

      if (answer.trim() !== dbName) {
         console.error('Confirmation did not match — aborting, nothing written.');
         process.exit(1);
      }
      return;
   }

   if (process.env.SEED_CONFIRM_DB !== dbName) {
      console.error(`Non-interactive run: set SEED_CONFIRM_DB=${dbName} to confirm the target database. Aborting, nothing written.`);
      process.exit(1);
   }
}
