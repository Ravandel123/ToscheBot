// Wipes all guild slash commands registered for the CURRENTLY configured
// application (whichever CLIENT_ID/BOT_TOKEN the active env resolves to).
// Use this to clean up Tyril's (the local test bot's) guild commands after a
// testing session, so they stop showing up alongside Tosche's in the picker —
// both bots register to the same GUILD_ID, and Discord lists them separately.
// Run with: npm run clear-commands  (or ENV_FILE=.env npm run clear-commands
// to explicitly target the test app regardless of the default env file)
import { REST, Routes } from 'discord.js';
import { config } from '../config.js';

const rest = new REST().setToken(config.token);
await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: [] });

console.log(`Cleared all guild slash commands for application ${config.clientId} on guild ${config.guildId}.`);
