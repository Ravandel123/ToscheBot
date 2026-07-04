import { BotConfig } from './types/core.js';

try {
   // Set ENV_FILE to load an alternate env file (e.g. `.env.production` to run
   // the live Tosche config locally instead of the default local/Tyril `.env`).
   process.loadEnvFile(process.env.ENV_FILE);
} catch {
   // No .env file — environment variables come from the host (e.g. the VPS service).
}

function requireEnv(name: string): string {
   const value = process.env[name];

   if (value)
      return value;

   throw new Error(`Missing required environment variable: ${name}`);
}

export const config: BotConfig = {
   token: requireEnv('BOT_TOKEN'),
   clientId: requireEnv('CLIENT_ID'),
   guildId: requireEnv('GUILD_ID'),
   ownerId: requireEnv('OWNER_ID'),
   mongodbUri: requireEnv('MONGODB_URI'),
   prefix: 'h!',
   // Optional: set OPENAI_API_KEY in .env to enable the AI persona.
   openaiApiKey: process.env.OPENAI_API_KEY || undefined,
   openaiModel: process.env.OPENAI_MODEL || 'gpt-5-nano',
};
