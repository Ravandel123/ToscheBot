// The typed target-database confirmation shared by every destructive CLI
// (seed-characters.ts, restore-backup.ts). A script writing to whatever
// `MONGODB_URI` resolves to is exactly the kind of action that must never
// happen "by accident" (a stray `ENV_FILE=.env.production`, or a future
// Claude session rerunning a script without this conversation's context).

/** The database name a Mongo connection string targets (the confirmation guard
 *  reads this — an unparseable URI is reported as such rather than thrown,
 *  since this only feeds a printed prompt, never a connection). */
export function dbNameFromUri(uri: string): string {
   try {
      const name = new URL(uri).pathname.replace(/^\//, '');
      return name || '(default)';
   } catch {
      return '(unparseable connection string)';
   }
}

/**
 * Prints the target database name up front and requires it confirmed before
 * any connection is made:
 *  - interactive terminal: type the database name back;
 *  - non-interactive (scripts, CI, an agent's shell): set `<envVar>=<name>`
 *    explicitly — there is no way to proceed blindly.
 * Each destructive script names its OWN env var (SEED_CONFIRM_DB,
 * RESTORE_CONFIRM_DB…) so a variable lingering in a shell can never authorize
 * a different script's action.
 */
export async function confirmTargetDatabase(uri: string, options: { action: string; envVar: string }): Promise<void> {
   const dbName = dbNameFromUri(uri);
   const redactedUri = uri.replace(/:\/\/[^@]*@/, '://***@');
   console.log(`Target database: '${dbName}' (${redactedUri})`);

   if (process.stdin.isTTY) {
      const { createInterface } = await import('node:readline/promises');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(`Type the database name to ${options.action} '${dbName}': `);
      rl.close();

      if (answer.trim() !== dbName) {
         console.error('Confirmation did not match — aborting, nothing written.');
         process.exit(1);
      }
      return;
   }

   if (process.env[options.envVar] !== dbName) {
      console.error(`Non-interactive run: set ${options.envVar}=${dbName} to confirm the target database. Aborting, nothing written.`);
      process.exit(1);
   }
}
