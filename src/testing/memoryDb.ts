import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Layer-1 test harness (CLAUDE.md "Testing against a real DB"): spins up a real,
// throwaway `mongod` in memory so service tests exercise the ACTUAL Mongo queries
// — aggregation-pipeline clamps, `$max`-guarded transitions, step-guarded
// optimistic updates — none of which a hand-mock could verify. No Atlas, no
// network (after the one-time binary cache), no secrets, no risk to live data.
//
// Usage: call `useTestDb()` once at the top of a `describe` (or file). It wires
// the mongoose default connection to the in-memory server for the whole file and
// wipes every collection between tests, so each `it` starts from a clean slate.
// The models register on that same default connection, exactly like production
// `connectDb`, so nothing about the code under test changes.

// The first run downloads a ~cached mongod binary; give the boot hook room for it.
const BOOT_TIMEOUT_MS = 120_000;

/**
 * Registers the lifecycle hooks that give the enclosing suite a private in-memory
 * MongoDB: boot before all tests, wipe collections after each, tear down after.
 * Call it once per test file (inside or outside a `describe`).
 */
export function useTestDb(): void {
   let mongod: MongoMemoryServer | undefined;

   beforeAll(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
   }, BOOT_TIMEOUT_MS);

   afterEach(async () => {
      // A clean slate per test: emptied, not dropped, so indexes built at model
      // registration (the itemService {ownerId,container} index, TTL, etc.) survive.
      const { collections } = mongoose.connection;
      for (const collection of Object.values(collections))
         await collection.deleteMany({});
   });

   afterAll(async () => {
      await mongoose.disconnect();
      await mongod?.stop();
   });
}
