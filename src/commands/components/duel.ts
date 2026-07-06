import { MessageFlags, type ButtonInteraction, type SendableChannels } from 'discord.js';
import { ComponentHandler } from '../../types/interactions.js';
import { characterService } from '../../db/services/characterService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { canCharacterAct } from '../../game/character/rules.js';
import { displayName } from '../../game/character/identity.js';
import { boutMode, type BoutMode } from '../../game/combat/bouts.js';
import { combatProfile } from '../../game/combat/profile.js';
import { resolveDuel, type DuelResult } from '../../game/combat/duel.js';
import { postChronicle } from '../../game/chronicle.js';
import { sleep } from '../../lib/async.js';
import {
   buildAcceptedCard,
   buildCancelledCard,
   buildDeclinedCard,
   buildOutcomeLine,
   duelOpeningLine,
   renderBlow,
} from './_duelView.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

// The serious duel (D16/combat.md R24): the consent gate + the auto-resolve
// fight on the REAL Health/Soak/opposed-d100 engine. Real damage is PERSISTED to
// each character's Health resource (it does not mend at once), and a fighter at
// 0 Health is Downed — unconscious, cannot act (canCharacterAct 'incapacitated')
// — but pays NO other cost (no Action Points, no permadeath): the owner's brief.
//
// Consent is load-bearing for async fairness (combat.md's locked rule): the card
// is posted with the fight uncommitted, and only the CHALLENGED player's Accept
// starts it — nobody loses Health while offline. Stateless like every component
// (ids ride in the customId), so the buttons survive a restart.
//
// SEAM for expansion: turn-by-turn manual control (combat.md R24 option 2) reuses
// this same profile/engine and would layer a durable ActivitySession + per-round
// buttons on top; wagers, a duel win/loss record, and Trial/PvE (NPC opponents)
// are the other documented next steps.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

// Pacing of the narrated bout (mirrors sparring, a touch tighter).
const INTRO_DELAY_MS = 1500;
const ROUND_DELAY_MS = 1200;

// One consent card must start at most one fight, but two near-simultaneous
// Accept clicks are two separate interactions that can BOTH pass the lock
// check before either acquires it. First click wins on the card's message id;
// in-memory is enough (single process), and once the winning click repaints
// the card its buttons are gone for good.
const startingCards = new Set<string>();

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
   if (!opponent || opponent.ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'This challenge is not yours to answer, soldier.', ...ephemeral });
      return;
   }

   // First-click-wins: the has+add below is synchronous, so of two clicks
   // racing this line exactly one proceeds to start the fight.
   if (startingCards.has(interaction.message.id)) {
      await interaction.reply({ content: 'That challenge is already being answered.', ...ephemeral });
      return;
   }
   startingCards.add(interaction.message.id);

   try {
      // A held lock means a fight is already running (an unrelated sparring
      // match, or a duel accepted a moment ago) — bail before queueing a second
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
      startingCards.delete(interaction.message.id);
   }
}

async function handleDecline(interaction: ButtonInteraction, challengerId: string, opponentId: string): Promise<void> {
   const opponent = await characterService.get(opponentId);
   if (!opponent || opponent.ownerId !== interaction.user.id) {
      await interaction.reply({ content: 'This challenge is not yours to answer, soldier.', ...ephemeral });
      return;
   }

   // A decline racing an accept must not repaint a fight-in-progress as declined.
   if (startingCards.has(interaction.message.id)) {
      await interaction.reply({ content: 'Too late — the duel is already underway.', ...ephemeral });
      return;
   }

   const challenger = await characterService.get(challengerId);
   await interaction.update(buildDeclinedCard(challenger ? displayName(challenger) : 'The challenger', displayName(opponent)));
}

/**
 * Runs the whole bout under both characters' lock (so regen/other writes can't
 * interleave — D5), re-reads the authoritative docs, resolves, narrates, then
 * persists each fighter's damage. Exported for a future manual-mode resolver to
 * reuse.
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
      // strips weapons/armour; full-gear fights as equipped — D35 bouts).
      const p1 = combatProfile(challenger, { loadout: mode.loadout });
      const p2 = combatProfile(opponent, { loadout: mode.loadout });
      const names = { [p1.characterId]: p1.name, [p2.characterId]: p2.name };
      const maxHealth = { [p1.characterId]: p1.maxHealth, [p2.characterId]: p2.maxHealth };

      const result = resolveDuel(p1, p2);
      await narrateDuel(channel, result, names, maxHealth, mode);

      // Persist REAL damage to both (delta = end − start, ≤ 0). Atomic clamped
      // deltas (D6) compose with the deferred regen that lands after we release.
      await Promise.all([
         applyDamage(p1.characterId, p1.health, result.finalHealth[p1.characterId]),
         applyDamage(p2.characterId, p2.health, result.finalHealth[p2.characterId]),
      ]);

      await postChronicle(client, chronicleLine(result, names));
   });
}

async function narrateDuel(channel: SendableChannels, result: DuelResult, names: Record<string, string>, maxHealth: Record<string, number>, mode: BoutMode): Promise<void> {
   const [challengerName, opponentName] = Object.values(names);

   await announce(channel, duelOpeningLine(challengerName, opponentName, mode));
   await sleep(INTRO_DELAY_MS);

   for (const blow of result.blows) {
      await announce(channel, renderBlow(blow, names));
      await sleep(ROUND_DELAY_MS);
   }

   await announce(channel, buildOutcomeLine(result, names, maxHealth));
}

async function applyDamage(characterId: string, startHealth: number, endHealth: number): Promise<void> {
   const delta = endHealth - startHealth;
   if (delta !== 0)
      await characterService.applyResourceDeltas(characterId, { health: delta });
}

/** A reason this character cannot duel right now, or null. Approval + Health via
 *  the shared `canCharacterAct` gate (D13), plus "not mid-activity" (D22). */
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

/** Channel line that never pings (chronicle-style). */
async function announce(channel: SendableChannels, content: string): Promise<void> {
   await channel.send({ content, allowedMentions: { parse: [] } });
}
