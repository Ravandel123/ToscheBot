import type { ActionRowBuilder, EmbedBuilder, MessageActionRowComponentBuilder } from 'discord.js';
import type { ActivitySessionDoc, ActivityType } from '../db/models/activitySession.js';
import type { CharacterDoc } from '../db/models/character.js';
import type { ComponentInteraction } from './interactions.js';
import type { ToscheClient } from '../client.js';

// The contract every durable-activity consumer implements (D22). A handler owns
// ONE ActivitySession `type`: it renders the session's current step from its
// persisted state and reacts to `activity:<action>:<sessionId>` components.
// Handlers live in `commands/components/_activities/` (loader-invisible) and
// are registered in that folder's `registry.ts`; the generic `activity`
// component router resolves the session, verifies the clicker owns a
// participant character, and dispatches here.

/** One step of an activity as it appears on Discord (spread into reply/update). */
export interface ActivityView {
   content?: string;
   embeds?: EmbedBuilder[];
   components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export interface ActivityHandler {
   type: ActivityType;
   /** Renders the session's CURRENT step from its state — used for the initial
    *  reply, re-entry ("you are mid-activity"), and stale-click repaints. Pure
    *  of side effects. */
   render(session: ActivitySessionDoc): ActivityView;
   /** Handles one component action for a session of this type. Must persist any
    *  step change through `activitySessionService.advance` (step-guarded) and
    *  respond to the interaction exactly once. `actor` is the participant
    *  character owned by the clicking user. */
   onAction(
      client: ToscheClient,
      interaction: ComponentInteraction,
      session: ActivitySessionDoc,
      actor: CharacterDoc,
      action: string,
      args: string[],
   ): Promise<void>;
}
