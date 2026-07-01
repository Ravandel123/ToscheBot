// Registers all slash commands for the single guild (guild-scoped commands
// propagate instantly; this bot never registers global commands — see D1).
// Run with: npm run deploy
import { REST, Routes } from 'discord.js';
import path from 'node:path';
import { config } from '../config.js';
import { loadDefaultExports } from '../core/loader.js';
import { SlashCommand } from '../types/commands.js';

const slashDir = path.join(import.meta.dirname, '..', 'commands', 'slash');
const commands = await loadDefaultExports<SlashCommand>(slashDir);
const body = commands.map((command) => command.data.toJSON());

const rest = new REST().setToken(config.token);
const result = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });

console.log(`Registered ${(result as unknown[]).length} guild slash commands: ${body.map((c) => c.name).join(', ')}`);
