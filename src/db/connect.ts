import mongoose from 'mongoose';
import { log } from '../lib/log.js';

export async function connectDb(uri: string): Promise<void> {
   mongoose.connection.on('error', (error) => {
      log.error('MongoDB connection error:', error);
   });
   mongoose.connection.on('disconnected', () => {
      log.warn('MongoDB disconnected.');
   });

   await mongoose.connect(uri);
   log.info('Connected to MongoDB.');
}

export async function disconnectDb(): Promise<void> {
   await mongoose.disconnect();
}
