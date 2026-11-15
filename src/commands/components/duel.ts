import type { ButtonInteraction, SendableChannels } from 'discord.js';
import type { ComponentHandler } from '../../types/interactions.js';
import { characterService } from '../../db/services/characterService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { boutService } from '../../db/services/boutService.js';
import { canCharacterAct } from '../../game/character/rules.js';
import { displayName } from '../../game/character/identity.js';
import { boutMode } from '../../game/combat/bouts.js';
import { combatProfile } from '../../game/combat/profile.js';
import { resolveDuel, type DuelResult } from '../../game/combat/duel.js';
import { pendingChallenges } from '../../game/combat/pendingChallenges.js';
import { postChronicle } from '../../game/chronicle.js';
import {
   buildAcceptedCard,
   buildCancelledCard,
   buildDeclinedCard,
   buildOutcomeLine,
   buildTrainingLine,
   duelOpeningLine,
} from './_duelView.js';
import { announce, MessageClaims, narrateBout } from './_boutNarration.js';
import { ephemeral } from '../../lib/discord.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

// The serious duel (combat.md): the consent gate + the auto-resolve fight on
// the REAL Health/Soak/opposed-d100 engine. Real damage is PERSISTED to
// each character's Health resource (it does not mend at once), and a fighter at
// 0 Health is Downed — unconscious, cannot act (canCharacterAct 'incapacitated')
// — but pays NO other cost (no Action Points, no permadeath): the owner's brief.
//
// Consent is load-bearing for async fairness (combat.md's locked rule): the card
// is posted with the fight uncommitted, and only the CHALLENGED player's Accept
// starts it — nobody loses Health while offline. Stateless like every component
// (ids ride in the customId), so the buttons survive a restart.

// One consent card starts at most one fight; once the winning click repaints
// the card its buttons are gone for good.
const startingCards = new MessageClaims();

export default {
   namespace: 'duel',
   async handle(client, interaction) {
      if (!interaction.isButton())
         return;

      const [, action, challengerId, opponentId, modeId = ''] = interaction.customId.split(':');
      if (!challengerId || !opponentId)
         return;

      if (action === 'decline') return handleDecline(interaction, challengerId, opponentId);
      if (action === 'accept') return handleAccept(client, interaction, challengerId, opponentId, modeId);
   },
} satisfies ComponentHandler;

async function handleAccept(client: ToscheClient, interaction: ButtonInteraction, challengerId: string, opponentId: string, modeId: string): Promise<void> {
   const opponent = await characterService.get(opponentId);
   if (opponent?.ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'This challenge is not yours to answer, soldier.', ...ephemeral });
      return;
   }

   if (!startingCards.claim(interaction.message.id)) {
      await interaction.reply({ content: 'That challenge is already being answered.', ...ephemeral });
      return;
   }
   // Answered, whatever happens next — the target may be challenged again.
   pendingChallenges.clear(opponentId);

   try {
      // A held lock means a fight is already running — bail before queueing a second
      // one behind it.
      if (client.locks.isLocked(challengerId) || client.locks.isLocked(opponentId)) {
         await interaction.reply({ content: 'One of you is already in a fight — let it finish first.', ...ephemeral });
         return;
      }

      const challenger = await characterService.get(challengerId);
      if (!challenger) {
         await interaction.update(buildCancelledCard('The challenger is no longer among us — the duel is off.'));
         return;
      }

      // Pre-flight eligibility for a clean message; the fight re-checks it
      // authoritatively under the lock (a downed/busy state can change in between).
      for (const fighter of [challenger, opponent]) {
         const reason = await duelBlock(fighter);
         if (reason) {
            await interaction.update(buildCancelledCard(`**${displayName(fighter)}** ${reason}.`));
            return;
         }
      }

      // Acknowledge the button now: the fight (narration delays + a possible wait
      // on the character lock) runs long past the 3 s interaction ack window.
      await interaction.update(buildAcceptedCard(challenger, opponent));

      const channel = interaction.channel;
      if (channel?.isSendable())
         await runDuel(client, channel, challengerId, opponentId, modeId);
   } finally {
      startingCards.release(interaction.message.id);
   }
}

async function handleDecline(interaction: ButtonInteraction, challengerId: string, opponentId: string): Promise<void> {
   const opponent = await characterService.get(opponentId);
   if (opponent?.ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'This challenge is not yours to answer, soldier.', ...ephemeral });
      return;
   }

   // A decline racing an accept must not repaint a fight-in-progress as declined.
   if (startingCards.has(interaction.message.id)) {
      await interaction.reply({ content: 'Too late — the duel is already underway.', ...ephemeral });
      return;
   }

   pendingChallenges.clear(opponentId);

   const challenger = await characterService.get(challengerId);
   await interaction.update(buildDeclinedCard(challenger ? displayName(challenger) : 'The challenger', displayName(opponent)));
}

/**
 * Runs the whole bout under both characters' lock (so regen and other writes
 * can't interleave), re-reads the authoritative docs, resolves, saves the
 * outcome, then narrates it.
 */
async function runDuel(client: ToscheClient, channel: SendableChannels, challengerId: string, opponentId: string, modeId: string): Promise<void> {
   const mode = boutMode(modeId);

   await client.locks.runExclusive([challengerId, opponentId], async () => {
      const [challenger, opponent] = await Promise.all([
         characterService.get(challengerId),
         characterService.get(opponentId),
      ]);

      if (!challenger || !opponent) {
         await announce(channel, 'A fighter vanished before the bell — the duel is off.');
         return;
      }

      for (const fighter of [challenger, opponent]) {
         const reason = await duelBlock(fighter);
         if (reason) {
            await announce(channel, `The duel is off — **${displayName(fighter)}** ${reason}.`);
            return;
         }
      }

      // The bout's loadout decides how gear feeds each profile (bare-knuckle
      // strips weapons/armour; full-gear fights as equipped).
      const p1 = combatProfile(challenger, { loadout: mode.loadout });
      const p2 = combatProfile(opponent, { loadout: mode.loadout });
      const names = { [p1.characterId]: p1.name, [p2.characterId]: p2.name };
      const maxHealth = { [p1.characterId]: p1.maxHealth, [p2.characterId]: p2.maxHealth };

      // Decide and SAVE the bout first (damage, learning, the win/loss record),
      // then tell it — a restart mid-narration must not undo a fought duel.
      const result = resolveDuel(p1, p2);
      const levelUps = await boutService.commitDuel(p1, p2, result);

      await narrateBout(channel, duelOpeningLine(p1.name, p2.name, mode), result, names);
      await announce(channel, buildOutcomeLine(result, names, maxHealth));
      for (const fighter of [p1, p2]) {
         const gained = levelUps[fighter.characterId];
         if (gained.length > 0)
            await announce(channel, buildTrainingLine(fighter.name, gained));
      }

      await postChronicle(client, chronicleLine(result, names));
   });
}

/** A reason this character cannot duel right now, or null: approval and
 *  Health via the shared `canCharacterAct` gate, plus "not mid-activity". */
async function duelBlock(character: CharacterDoc): Promise<string | null> {
   const act = canCharacterAct(character);
   if (!act.ok)
      return act.reason === 'not-approved'
         ? 'is not yet recognized by the Imperator'
         : 'is in no shape to fight';

   if (await activitySessionService.getActiveForParticipant(character._id))
      return 'is already occupied elsewhere';

   return null;
}

function chronicleLine(result: DuelResult, names: Record<string, string>): string {
   const winner = names[result.winnerId];
   const loser = names[result.loserId];

   return result.knockout
      ? `⚔️ **${winner}** knocked **${loser}** out cold in a duel at the Smackdown Spire.`
      : `⚔️ **${winner}** edged **${loser}** on points in a duel at the Smackdown Spire.`;
}
