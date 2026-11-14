import mongoose from 'mongoose';
import { sleep } from '../lib/async.js';
import { log } from '../lib/log.js';

// The host restarts a crashed bot but gives up after two crashes in quick
// succession, so a brief Atlas outage at boot must be waited out here instead
// of exiting. Waits between attempts: 5 s, 10 s, 20 s, 40 s.
const CONNECT_ATTEMPTS = 5;
const CONNECT_RETRY_BASE_MS = 5_000;

/** `retry` is for the long-running bot only — scripts should fail at once. */
export async function connectDb(uri: string, { retry = false } = {}): Promise<void> {
   const attempts = retry ? CONNECT_ATTEMPTS : 1;

   mongoose.connection.on('error', (error) => {
      log.error('MongoDB connection error:', error);
   });
   mongoose.connection.on('disconnected', () => {
      log.warn('MongoDB disconnected.');
   });

   for (let attempt = 1; ; attempt++)
      try {
         await mongoose.connect(uri);
         break;
      } catch (error) {
         if (attempt >= attempts)
            throw error;

         const waitMs = CONNECT_RETRY_BASE_MS * 2 ** (attempt - 1);
         log.warn(`MongoDB connect attempt ${attempt}/${attempts} failed; retrying in ${waitMs / 1000}s.`, error);
         await sleep(waitMs);
      }

   log.info('Connected to MongoDB.');
}

export async function disconnectDb(): Promise<void> {
   await mongoose.disconnect();
}
