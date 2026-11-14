import { config } from './config.js';
import { ToscheClient } from './client.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { log } from './lib/log.js';

const client = new ToscheClient();
const shutdownTimeoutMs = 10_000;

let shuttingDown = false;

async function shutdown(reason: string, exitCode = 0): Promise<void> {
   if (shuttingDown) {
      log.warn(`Shutdown already in progress; ignoring ${reason}.`);
      return;
   }

   shuttingDown = true;
   log.info(`Received ${reason}, shutting down.`);

   const forceExit = setTimeout(() => {
      log.error(`Shutdown timed out after ${shutdownTimeoutMs}ms; forcing exit.`);
      process.exit(1);
   }, shutdownTimeoutMs).unref();

   try {
      await client.destroy();
      await disconnectDb();
   } catch (error) {
      log.error('Error during shutdown:', error);
      exitCode = 1;
   } finally {
      clearTimeout(forceExit);
      process.exit(exitCode);
   }
}

async function start(): Promise<void> {
   try {
      await client.init();
      await connectDb(config.mongodbUri, { retry: true });
      await client.login(config.token);
   } catch (error) {
      log.error('Startup failed:', error);
      await shutdown('startup failure', 1);
   }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Log-only on purpose: every dispatch boundary already catches, so a stray
// rejection is a bug to fix, not a reason to drop the bot. The host restarts a
// crashed process but gives up after two crashes in quick succession, so a
// repeating rejection would leave the bot offline until a manual start.
process.on('unhandledRejection', (reason) => {
   log.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
   log.error('Uncaught exception:', error);
   void shutdown('uncaught exception', 1);
});

await start();
