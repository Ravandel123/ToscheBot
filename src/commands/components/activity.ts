import { MessageFlags } from 'discord.js';
import type { ComponentHandler, ComponentInteraction } from '../../types/interactions.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { isExpired } from '../../game/activity/session.js';
import { activityHandler } from './_activities/registry.js';
import { log } from '../../lib/log.js';

// The generic router for every durable activity (D22). CustomIds are
// `activity:<action>:<sessionId>[:...args]` — stateless like the character
// panel and the comic browser, so activity buttons keep working across
// restarts: the session (with its per-step state) is re-read from the DB and
// dispatched to the handler that owns its type. The router does the shared
// work (session exists? still active? is the clicker a participant?); the
// handler owns the step logic.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export default {
   namespace: 'activity',
   async handle(client, interaction) {
      const [, action, sessionId, ...args] = interaction.customId.split(':');

      // Lazy expiry: a lapsed session counts as ended even before the TTL
      // index physically deletes it (timeout ⇒ forfeit, D17).
      const session = sessionId ? await activitySessionService.get(sessionId) : null;
      if (session?.status !== 'active' || isExpired(session.expiresAt)) {
         await endedReply(interaction);
         return;
      }

      // The clicker must OWN a participant character (ownership, not "active
      // character", so switching drafts elsewhere can't orphan a session).
      const participants = await Promise.all(session.participantIds.map((id) => characterService.get(id)));
      const actor = participants.find((character) => character?.ownerId === interaction.user.id);
      if (!actor) {
         await interaction.reply({ content: 'This is not your struggle, soldier.', ...ephemeral });
         return;
      }

      const handler = activityHandler(session.type);
      if (!handler) {
         // A session of a retired/renamed type — end it gracefully (D10 rule 3).
         log.warn(`No activity handler for session type '${session.type}' (session ${session._id}).`);
         await endedReply(interaction);
         return;
      }

      await handler.onAction(client, interaction, session, actor, action, args);
   },
} satisfies ComponentHandler;

/** Repaints the pressed message as ended when possible, else replies ephemerally. */
async function endedReply(interaction: ComponentInteraction): Promise<void> {
   const payload = { content: 'This activity has already ended.', embeds: [], components: [] };

   if (interaction.isButton() || interaction.isAnySelectMenu())
      await interaction.update(payload);
   else
      await interaction.reply({ content: payload.content, ...ephemeral });
}
