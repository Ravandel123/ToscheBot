import { MessageFlags, type ButtonInteraction, type SendableChannels } from 'discord.js';
import type { ComponentHandler } from '../../types/interactions.js';
import { settings } from '../../settings.js';
import { accountService } from '../../db/services/accountService.js';
import { characterService } from '../../db/services/characterService.js';
import { smackdownService } from '../../db/services/smackdownService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { resolveDuel } from '../../game/combat/duel.js';
import { combatProfile } from '../../game/combat/profile.js';
import { LADDER_LENGTH, championProfile, trialTarget, type SpireChampion, type TrialTarget } from '../../game/combat/spireLadder.js';
import { canCharacterAct } from '../../game/character/rules.js';
import { displayName } from '../../game/character/identity.js';
import { postChronicle } from '../../game/chronicle.js';
import { renderBlow } from './_duelView.js';
import { buildTrialBrowser, buildTrialOpening, buildTrialResult, buildTrialSentOff } from './_trialView.js';
import { resolveGuildChannel } from '../../lib/discord.js';
import { sleep } from '../../lib/async.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

// The PvE Spire ladder interface (`/smackdown trial`, D37). The slash command
// opens an ephemeral browser (`_trialView`); this handler owns its two actions:
//   - `show`  — scroll to another champion (stateless: the index rides the id);
//   - `fight` — commit to the bout, which narrates in the Spire channel on the
//     REAL Health/Soak engine and persists ONLY the player's Health (the champion
//     is a code stat block, D37). Mirrors `duel.ts`'s ack-then-run choreography.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;
const INTRO_DELAY_MS = 1500;
const ROUND_DELAY_MS = 1300;
const SPIRE_MISSING = 'The Spire is missing. Set `channels.smackdownSpire` in settings to a real channel.';

// First-click-wins per panel: two near-simultaneous Fight clicks are two
// interactions that can both pass the lock check before either acquires it.
const startingFights = new Set<string>();

export default {
   namespace: 'trial',
   async handle(client, interaction) {
      if (!interaction.isButton())
         return;

      const [, action, arg] = interaction.customId.split(':');
      if (action === 'show') return showChampion(interaction, Number(arg));
      if (action === 'fight' && arg) return fightChampion(client, interaction, arg);
   },
} satisfies ComponentHandler;

/** Scroll the roster. The panel is ephemeral + personal, so re-resolve the
 *  clicker's own progress and repaint at the requested (clamped) index. */
async function showChampion(interaction: ButtonInteraction, index: number): Promise<void> {
   const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
   if (!character) {
      await interaction.update({ content: 'You have no active character.', embeds: [], components: [] });
      return;
   }

   const record = await smackdownService.getOrCreate(character._id, displayName(character));
   await interaction.update(buildTrialBrowser(record.trialRung ?? 0, index));
}

async function fightChampion(client: ToscheClient, interaction: ButtonInteraction, championId: string): Promise<void> {
   if (!interaction.guild) {
      await interaction.reply({ content: 'The Spire ladder is climbed on the server, not in DMs.', ...ephemeral });
      return;
   }

   const spire = resolveGuildChannel(interaction.guild, settings.channels.smackdownSpire);
   if (!spire?.isSendable()) {
      await interaction.reply({ content: SPIRE_MISSING, ...ephemeral });
      return;
   }

   const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
   if (!character) {
      await interaction.reply({ content: 'You have no active character to fight with.', ...ephemeral });
      return;
   }

   const problem = actProblem(character);
   if (problem) {
      await interaction.reply({ content: problem, ...ephemeral });
      return;
   }

   // A held lock means a fight is already running for this character — bail
   // before queueing a second one behind it.
   if (client.locks.isLocked(character._id)) {
      await interaction.reply({ content: 'You are already in a fight — let it finish first.', ...ephemeral });
      return;
   }

   if (startingFights.has(interaction.message.id)) {
      await interaction.reply({ content: 'You are already heading to the Spire.', ...ephemeral });
      return;
   }
   startingFights.add(interaction.message.id);

   try {
      // Pre-lock resolve for a friendly refusal; the fight re-resolves under the
      // lock authoritatively (a concurrent trial can't double-advance or re-award).
      const record = await smackdownService.getOrCreate(character._id, displayName(character));
      const preview = trialFightable(trialTarget(championId, record.trialRung ?? 0));
      if ('reason' in preview) {
         await interaction.reply({ content: preview.reason, ...ephemeral });
         return;
      }

      // Ack the button now: the fight (narration delays + a possible lock wait)
      // runs long past the 3 s interaction window. Repaint the panel first.
      await interaction.update(buildTrialSentOff(spire.id, preview.champion, preview.isRematch));

      await runTrialFight(client, spire, character._id, championId);
   } finally {
      startingFights.delete(interaction.message.id);
   }
}

/** The bout under the character's lock: re-read authoritatively, re-resolve the
 *  rung, resolve + narrate the fight, then persist the player's Health and (on a
 *  fresh climb win) advance the rung + pay the reward. */
async function runTrialFight(client: ToscheClient, spire: SendableChannels, characterId: string, championId: string): Promise<void> {
   await client.locks.runExclusive([characterId], async () => {
      const fighter = await characterService.get(characterId);
      if (!fighter) {
         await announce(spire, 'The challenger never showed — the bout is off.');
         return;
      }

      const act = canCharacterAct(fighter);
      if (!act.ok) {
         await announce(spire, `**${displayName(fighter)}** is in no shape to fight the ladder right now.`);
         return;
      }
      if (await activitySessionService.getActiveForParticipant(fighter._id)) {
         await announce(spire, `**${displayName(fighter)}** is occupied elsewhere — the ladder can wait.`);
         return;
      }

      const rung = (await smackdownService.getOrCreate(fighter._id, displayName(fighter))).trialRung ?? 0;
      const target = trialFightable(trialTarget(championId, rung));
      if ('reason' in target) {
         await announce(spire, target.reason);
         return;
      }
      const { champion: champ, isRematch } = target;

      const player = combatProfile(fighter); // trials are fought as-equipped
      const foe = championProfile(champ);
      const names = { [player.characterId]: player.name, [foe.characterId]: foe.name };

      const result = resolveDuel(player, foe);

      await announce(spire, buildTrialOpening(player.name, champ, isRematch));
      await sleep(INTRO_DELAY_MS);
      for (const blow of result.blows) {
         await announce(spire, renderBlow(blow, names));
         await sleep(ROUND_DELAY_MS);
      }

      // Persist ONLY the player's Health (the champion is not a real character).
      const playerHp = result.finalHealth[player.characterId];
      const delta = playerHp - player.health;
      if (delta !== 0)
         await characterService.applyResourceDeltas(fighter._id, { health: delta });

      const won = result.winnerId === player.characterId;
      let rewardCoins = 0;
      let ladderCleared = false;

      // Reward + rung advance ONLY on a fresh climb win — a rematch pays nothing.
      if (won && !isRematch) {
         rewardCoins = champ.reward.coins;
         await smackdownService.advanceTrial(fighter._id, displayName(fighter), rung + 1);
         await characterService.applyCurrencyDeltas(fighter._id, { deltradaCoins: rewardCoins });
         ladderCleared = rung + 1 >= LADDER_LENGTH;
      }

      await announce(spire, buildTrialResult({
         won, champion: champ, playerName: player.name, playerHp, playerMaxHp: player.maxHealth,
         rungBeaten: target.rung, ladderLength: LADDER_LENGTH, rewardCoins, ladderCleared, isRematch,
      }));

      await postChronicle(client, chronicleTrialLine(displayName(fighter), champ.name, won, isRematch, rung));
   });
}

/** A reason the active character cannot fight the ladder right now, or null. */
function actProblem(character: CharacterDoc): string | null {
   const act = canCharacterAct(character);
   if (act.ok)
      return null;

   return act.reason === 'not-approved'
      ? 'Your character must be recognized by the Imperator before climbing the Spire.'
      : 'Your character is in no shape to fight right now.';
}

/** Turns a resolved trial target into a fightable champion, or a refusal reason
 *  (nothing left to climb, or a champion not yet earned). */
function trialFightable(target: TrialTarget): { champion: SpireChampion; rung: number; isRematch: boolean } | { reason: string } {
   if (target.kind === 'cleared')
      return { reason: `You have already bested every fighter in the Spire (${LADDER_LENGTH}/${LADDER_LENGTH}). None remain to challenge you, champion.` };
   if (target.kind === 'locked')
      return { reason: `You have not earned a bout with **${target.champion.name}** yet — best the earlier champions first.` };

   return { champion: target.champion, rung: target.rung, isRematch: target.kind === 'rematch' };
}

function chronicleTrialLine(name: string, championName: string, won: boolean, isRematch: boolean, rung: number): string {
   if (!won)
      return `🏟️ **${name}** was knocked out by **${championName}** ${isRematch ? 'in a Spire rematch' : 'on the Spire ladder'}.`;
   if (isRematch)
      return `🏟️ **${name}** won a friendly rematch against **${championName}** at the Spire.`;

   return `🏟️ **${name}** bested **${championName}** and climbed to rung ${rung + 1}/${LADDER_LENGTH} of the Spire ladder.`;
}

/** Channel line that never pings (chronicle-style). */
async function announce(channel: SendableChannels, content: string): Promise<void> {
   await channel.send({ content, allowedMentions: { parse: [] } });
}
