// Populates (or refreshes) the hand-authored NPC roster from game/data/npcs.ts:
// an idempotent update-by-npcId (D44) — a fresh database gets the full cast, a
// rerun refreshes names/races/homes and NEVER resets what NPCs have since
// gained or lost (inventory, coins, progression — AUDIT §3.3). Run with:
// npm run seed-npcs (ENV_FILE=.env.production to target the live DB — see the
// confirmation guard below).
//
// This file is the thin runnable shell: env → connect → seed → disconnect.
// The logic lives in npcSeed.ts (no `config` import there) so it stays
// testable against an in-memory DB.
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db/connect.js';
import { confirmTargetDatabase } from './confirmDb.js';
import { NPC_IDS } from '../game/data/npcs.js';
import { runNpcSeed } from './npcSeed.js';

// A script writing to whatever `MONGODB_URI` resolves to must never run "by
// accident" — the shared guard (confirmDb.ts) requires the target database
// name typed back (or SEED_NPCS_CONFIRM_DB=<name> non-interactively).
await confirmTargetDatabase(config.mongodbUri, { action: 'seed NPCs into', envVar: 'SEED_NPCS_CONFIRM_DB' });
await connectDb(config.mongodbUri);

try {
   const report = await runNpcSeed();
   for (const line of report.lines)
      console.log(line);
   console.log(`Done: ${report.created} created, ${report.updated} updated, ${report.unchanged} unchanged (of ${NPC_IDS.length} NPCs).`);
} finally {
   await disconnectDb();
}
