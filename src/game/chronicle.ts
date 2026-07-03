import type { Client } from 'discord.js';
import { config } from '../config.js';
import { settings } from '../settings.js';
import { resolveGuildChannel } from '../lib/discord.js';
import { log } from '../lib/log.js';

// Discord adapter (marked): the public game log (D24). Gameplay replies are
// ephemeral (only the actor sees their journey/steps); anything NOTEWORTHY a
// character does is posted here as a short in-character line, so the whole
// server can follow what is happening in the game. Best-effort by design:
// a missing channel must never fail the action it chronicles.

/** Posts one line to the chronicle channel. Never throws. */
export async function postChronicle(client: Client, line: string): Promise<void> {
   try {
      const guild = client.guilds.cache.get(config.guildId);
      if (!guild) {
         log.warn('Chronicle: guild not in cache; skipping entry.');
         return;
      }

      const channel = resolveGuildChannel(guild, settings.channels.chronicle);
      if (!channel?.isSendable()) {
         log.warn(`Chronicle channel '${settings.channels.chronicle}' not found or not sendable.`);
         return;
      }

      // Chronicle lines quote character names, never live pings.
      await channel.send({ content: line, allowedMentions: { parse: [] } });
   } catch (error) {
      log.warn('Chronicle post failed:', error);
   }
}
