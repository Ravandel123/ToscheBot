import { Message } from 'discord.js';
import { defineEvent } from '../types/events.js';
import { config } from '../config.js';
import { log } from '../lib/log.js';
import { findBannedWord } from '../moderation/bannedWords.js';
import { handleBannedMessage } from '../moderation/espionage.js';
import { maybeRespondWithAi } from '../ai/trigger.js';
import type { ToscheClient } from '../client.js';

// Light anti-spam for troll commands; individual commands override via cooldownSeconds.
const DEFAULT_COOLDOWN_SECONDS = 1;

export default defineEvent({
   name: 'messageCreate',
   async execute(client, message) {
      if (message.author.bot)
         return;

      // Single-guild bot (see CLAUDE.md): only act on Deltrada.
      if (message.guildId !== config.guildId)
         return;

      // Moderation runs before everything else (the owner is exempt).
      if (message.author.id !== config.ownerId) {
         const banned = findBannedWord(message.content);
         if (banned) {
            await handleBannedMessage(message, banned);
            return;
         }
      }

      if (message.content.toLowerCase().startsWith(config.prefix)) {
         await handlePrefixCommand(client, message);
         return;
      }

      // Not a command → Tosche may butt in (only if AI is enabled).
      await maybeRespondWithAi(client, message);
   },
});

async function handlePrefixCommand(client: ToscheClient, message: Message): Promise<void> {
   const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
   const commandName = args.shift()?.toLowerCase();

   if (!commandName)
      return;

   const command = client.resolvePrefixCommand(commandName);

   if (!command)
      return;

   const isOwner = message.author.id === config.ownerId;

   if (command.ownerOnly && !isOwner) {
      await message.reply('Only the Imperator gives me orders.');
      return;
   }

   if (command.requiredPermissions?.length && !isOwner && !message.member?.permissions.has(command.requiredPermissions)) {
      await message.reply('You lack the authority for that, soldier.');
      return;
   }

   const remaining = isOwner
      ? 0
      : client.cooldowns.use(`p:${command.name}`, message.author.id, command.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS);

   if (remaining > 0) {
      await message.reply(`Patience! Try again in ${remaining.toFixed(1)}s.`);
      return;
   }

   try {
      await command.execute(message, args);
   } catch (error) {
      log.error(`Prefix command '${command.name}' failed:`, error);

      try {
         await message.reply('Something went wrong on my end. The scribes have been notified.');
      } catch {
         // Channel may be gone or unwritable; the log line above is enough.
      }
   }
}
