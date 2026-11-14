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
import { SEED_CHARACTERS as TEMPLATE_ROSTER, type SeedCharacter } from './seed-data.js';
import { runSeed, validateRoster } from './seed.js';

// The real roster lives in the gitignored seed-data.local.ts (the repo is
// public; Discord ids and names stay off it). The path is a variable so the
// type-check does not require the file to exist (CI has none).
async function loadRoster(): Promise<SeedCharacter[]> {
   const localModule = './seed-data.local.js';
   try {
      const local = await import(localModule) as { SEED_CHARACTERS?: SeedCharacter[] };
      if (local.SEED_CHARACTERS)
         return local.SEED_CHARACTERS;
   } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND')
         throw error;
   }
   return TEMPLATE_ROSTER;
}

const SEED_CHARACTERS = await loadRoster();

if (SEED_CHARACTERS.length === 0) {
   console.log('No entries — create src/scripts/seed-data.local.ts exporting SEED_CHARACTERS (template in seed-data.ts).');
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
