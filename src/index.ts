import { config } from './config.js';
import { ToscheClient } from './client.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { log } from './lib/log.js';

const client = new ToscheClient();

async function shutdown(signal: string): Promise<void> {
   log.info(`Received ${signal}, shutting down.`);
   await client.destroy();
   await disconnectDb();
   process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
   log.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
   log.error('Uncaught exception, exiting:', error);
   process.exit(1);
});

await client.init();
await connectDb(config.mongodbUri);
await client.login(config.token);
