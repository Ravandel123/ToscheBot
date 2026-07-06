import { PrefixCommand } from '../../../types/commands.js';
import { botClient } from '../../../lib/discord.js';
import { postDatabaseBackup } from '../../../jobs/dbBackup.js';

export default {
   name: 'backup',
   description: 'Dump the whole game database to the espionage archive, right now.',
   category: 'admin',
   ownerOnly: true,
   async execute(message) {
      // Always posted to #espionage (never the invoking channel) — the dump
      // holds every player's data and must not land in a public channel.
      const status = await postDatabaseBackup(botClient(message));
      await message.reply(status);
   },
} satisfies PrefixCommand;
