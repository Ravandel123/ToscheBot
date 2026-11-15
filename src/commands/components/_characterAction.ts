// The steps every mutating character action shares, around its own logic:
//   before the lock — `deferIfFree`: refuse while a short action holds the
//     character (don't queue a click behind a whole fight), else acknowledge
//     the click (the lock wait and the writes can pass Discord's ~3 s window);
//   inside the lock — `readyCharacter`: re-read the character, send it back to
//     its unfinished activity if it has one, and check it may act at all.
// Underscore prefix → loader skips it.
import type { MessageComponentInteraction } from 'discord.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { canCharacterAct, type ActBlockReason } from '../../game/character/rules.js';
import { activityStepView } from './_activities/registry.js';
import { freshHubView } from './_hubView.js';
import { ephemeral, type PanelView } from '../../lib/discord.js';
import type { ActivitySessionDoc } from '../../db/models/activitySession.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

export const NO_ACTIVE_CHARACTER = 'You have no active character. Draft one with `/character create`.';
export const BUSY_RIGHT_NOW = '⏳ Your character is busy right now — try again in a moment.';
const CHARACTER_GONE = 'Your character could not be found. Open the panel again.';

/** The character behind a personal panel, if the clicker owns it; otherwise
 *  answers "That isn't your <what>." and returns null. */
export async function ownedCharacter(interaction: MessageComponentInteraction, characterId: string, what: string): Promise<CharacterDoc | null> {
   const character = await characterService.get(characterId);
   if (character?.ownerId === interaction.user.id)
      return character;

   await interaction.reply({ content: `That isn't your ${what}.`, ...ephemeral });
   return null;
}

/** Acknowledges a mutating click — or, while the character's lock is held,
 *  refuses it privately and returns false. */
export async function deferIfFree(client: ToscheClient, interaction: MessageComponentInteraction, characterId: string): Promise<boolean> {
   if (client.locks.isLocked(characterId)) {
      await interaction.reply({ content: BUSY_RIGHT_NOW, ...ephemeral });
      return false;
   }

   await interaction.deferUpdate();
   return true;
}

export interface ReadyOptions {
   /** What a character with an unfinished activity is shown instead. Default:
    *  that activity's current step, so the player lands back in it. */
   busyView?: (session: ActivitySessionDoc, fresh: CharacterDoc) => PanelView | Promise<PanelView>;
   /** Check the character may act at this Action Point cost; a refusal
    *  repaints the hub with the matching line. */
   act?: { cost: number; blocked: Record<ActBlockReason, string> };
}

/**
 * The character, re-read inside its lock and cleared to act — or null, after
 * the refusal was already sent with `editReply` (the click must have been
 * acknowledged first).
 */
export async function readyCharacter(interaction: MessageComponentInteraction, characterId: string, options: ReadyOptions = {}): Promise<CharacterDoc | null> {
   const fresh = await characterService.get(characterId);
   if (!fresh) {
      await interaction.editReply({ content: CHARACTER_GONE, embeds: [], components: [] });
      return null;
   }

   const session = await activitySessionService.getActiveForParticipant(fresh._id);
   if (session) {
      await interaction.editReply(options.busyView ? await options.busyView(session, fresh) : activityStepView(session));
      return null;
   }

   if (options.act) {
      const act = canCharacterAct(fresh, options.act.cost);
      if (!act.ok) {
         await interaction.editReply(await freshHubView(fresh, options.act.blocked[act.reason]));
         return null;
      }
   }

   return fresh;
}
