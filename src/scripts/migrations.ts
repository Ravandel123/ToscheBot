import mongoose from 'mongoose';

// Data migrations, for the rare change that optional fields cannot absorb.
// Split from the CLI (migrate.ts) so the logic runs against the in-memory test
// DB. Rules:
//   - every migration is IDEMPOTENT: `npm run migrate` reruns the whole list
//     each time, so no "applied" bookkeeping is stored;
//   - entries are append-only and never edited once run against the live DB;
//   - a migration talks to the raw collection — the mongoose schema usually no
//     longer knows the fields being removed or reshaped.

export interface Migration {
   /** `YYYY-MM-short-slug`, unique. */
   id: string;
   description: string;
   /** Applies the change; returns how many documents it modified. */
   run(db: mongoose.mongo.Db): Promise<number>;
}

export const MIGRATIONS: readonly Migration[] = [
   {
      id: '2026-11-drop-sparring-record-fields',
      description: 'Remove eloRating/wins/losses left on fight records by the removed /smackdown sparring.',
      async run(db) {
         const result = await db.collection('smackdownrecords').updateMany(
            { $or: [{ eloRating: { $exists: true } }, { wins: { $exists: true } }, { losses: { $exists: true } }] },
            { $unset: { eloRating: '', wins: '', losses: '' } },
         );
         return result.modifiedCount;
      },
   },
   {
      id: '2026-11-sessions-never-expire',
      description: 'Drop the activity-session TTL index and the expiresAt field (sessions no longer expire).',
      async run(db) {
         const sessions = db.collection('activitysessions');

         // The index goes FIRST: unsetting the field under a live TTL index is
         // harmless, but the reverse order would leave a window to reap docs.
         if (await db.listCollections({ name: 'activitysessions' }).hasNext())
            for (const index of await sessions.indexes())
               if (index.expireAfterSeconds !== undefined && index.name)
                  await sessions.dropIndex(index.name);

         const result = await sessions.updateMany({ expiresAt: { $exists: true } }, { $unset: { expiresAt: '' } });
         return result.modifiedCount;
      },
   },
];

export interface MigrationReport {
   lines: string[];
   modified: number;
}

/** Runs every migration in order against the connected database. */
export async function runMigrations(migrations: readonly Migration[] = MIGRATIONS): Promise<MigrationReport> {
   const db = mongoose.connection.db;
   if (!db)
      throw new Error('runMigrations needs an open database connection.');

   const report: MigrationReport = { lines: [], modified: 0 };
   for (const migration of migrations) {
      const modified = await migration.run(db);
      report.modified += modified;
      report.lines.push(`${migration.id}: ${modified} document(s) changed — ${migration.description}`);
   }

   return report;
}
