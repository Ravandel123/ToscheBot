import { AttachmentBuilder } from 'discord.js';
import type { CronJob } from '../types/jobs.js';
import { config } from '../config.js';
import { settings } from '../settings.js';
import { backupFileName, buildBackupDump, documentCount } from '../db/backup.js';
import { resolveGuildChannel } from '../lib/discord.js';
import { log } from '../lib/log.js';
import type { ToscheClient } from '../client.js';

// Daily database backup (the idea-backlog "DB backup job", accepted 2026-07-06;
// daily rather than weekly — the dump is a few KB at this scale and an alpha
// that wipes/changes often deserves a short recovery window). Posts the JSON
// dump to #espionage (the owner-side log channel); `h!backup` runs the same
// path on demand before risky operations.

// Discord caps regular-bot attachments; refuse with a warning instead of
// erroring the send if the game ever outgrows it (then it's time for real
// off-Discord backups).
const MAX_ATTACHMENT_BYTES = 9 * 1024 * 1024;

export default {
   name: 'db-backup',
   schedule: '30 4 * * *', // daily at 04:30 — quiet hours, away from the hourly regen tick
   async run(client) {
      log.info(await postDatabaseBackup(client));
   },
} satisfies CronJob;

/** Builds the dump and posts it to the espionage channel. Returns a one-line
 *  status (logged by the cron, replied by `h!backup`). Never throws for a
 *  missing channel — a backup failure must be visible, not fatal. */
export async function postDatabaseBackup(client: ToscheClient): Promise<string> {
   const dump = await buildBackupDump();
   const buffer = Buffer.from(JSON.stringify(dump), 'utf8');
   const docs = documentCount(dump);

   const guild = client.guilds.cache.get(config.guildId);
   const channel = guild ? resolveGuildChannel(guild, settings.channels.espionage) : undefined;
   if (!channel?.isSendable())
      return `⚠️ Backup built (${docs} documents) but the espionage channel is missing — nothing posted.`;

   if (buffer.length > MAX_ATTACHMENT_BYTES) {
      await channel.send(`⚠️ The database backup (${Math.round(buffer.length / 1024)} KB) no longer fits a Discord attachment — set up an external backup path.`);
      return '⚠️ Backup too large for a Discord attachment — warning posted instead.';
   }

   await channel.send({
      content: `🗄️ Database backup — **${docs}** documents across ${Object.keys(dump.collections).length} collections.`,
      files: [new AttachmentBuilder(buffer, { name: backupFileName() })],
   });

   return `🗄️ Backup posted to the archive (${docs} documents, ${Math.round(buffer.length / 1024)} KB).`;
}
