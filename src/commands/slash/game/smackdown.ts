import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction, type SendableChannels } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { settings } from '../../../settings.js';
import { accountService } from '../../../db/services/accountService.js';
import { characterService } from '../../../db/services/characterService.js';
import { smackdownService } from '../../../db/services/smackdownService.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { combatStatsFromCharacter } from '../../../game/combat/stats.js';
import { simulateFight, type RoundEvent } from '../../../game/combat/engine.js';
import { resolveDuel } from '../../../game/combat/duel.js';
import { combatProfile } from '../../../game/combat/profile.js';
import { LADDER_LENGTH, SPIRE_LADDER, championProfile, trialTarget, type SpireChampion, type TrialTarget } from '../../../game/combat/spireLadder.js';
import { COMBAT_MOVES, HIT_LOCATIONS, START_GIFS, FINISH_GIFS } from '../../../game/combat/flavor.js';
import { canCharacterAct } from '../../../game/character/rules.js';
import { displayName } from '../../../game/character/identity.js';
import { DEFAULT_BOUT_MODE, boutMode, selectableBoutModes } from '../../../game/combat/bouts.js';
import { buildChallengeButtons, buildChallengeCard, renderBlow } from '../../components/_duelView.js';
import { buildTrialOpening, buildTrialResult } from '../../components/_trialView.js';
import { postChronicle } from '../../../game/chronicle.js';
import { randomItem } from '../../../lib/random.js';
import { resolveGuildChannel } from '../../../lib/discord.js';
import { sleep } from '../../../lib/async.js';
import type { CharacterDoc } from '../../../db/models/character.js';
import type { ToscheClient } from '../../../client.js';

// Pacing of the narrated fight, so it reads like a brawl rather than a wall of text.
const INTRO_DELAY_MS = 1500;
const ROUND_DELAY_MS = 1300;
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

function renderRound(round: RoundEvent, names: Record<string, string>): string {
   const attacker = names[round.attackerId];
   const defender = names[round.defenderId];
   const move = randomItem(COMBAT_MOVES);
   const location = randomItem(HIT_LOCATIONS);

   if (round.hit)
      return `**${attacker}** ${move} **${defender}**'s ${location} for **${round.damage}**! _(${defender}: ${round.defenderHpAfter} HP)_`;

   return `**${attacker}** lunges at **${defender}**'s ${location} — but misses!`;
}

export default {
   // Two tiers (D16): `sparring` is the for-fun, no-stakes brawl (any active
   // character, fantasy HP, Elo only); `duel` is the SERIOUS bout — an approved
   // character, real Health that is spent and persists, a knockout at 0, and the
   // target must consent by button (combat.md R24 / Health+Soak engine).
   data: new SlashCommandBuilder()
      .setName('smackdown')
      .setDescription('Brawls in the Smackdown Spire.')
      .addSubcommand((sub) =>
         sub
            .setName('sparring')
            .setDescription('A friendly, for-fun sparring match — nothing at stake but pride.')
            .addUserOption((option) =>
               option.setName('opponent').setDescription('Who to fight.').setRequired(true),
            ),
      )
      .addSubcommand((sub) =>
         sub
            .setName('duel')
            .setDescription('A real bout — actual wounds that linger, a knockout at zero Health. The target must accept.')
            .addUserOption((option) =>
               option.setName('opponent').setDescription('Who to challenge.').setRequired(true),
            )
            .addStringOption((option) => {
               option.setName('mode').setDescription('Fight rules (default: full gear).');
               for (const { id, mode } of selectableBoutModes())
                  option.addChoices({ name: `${mode.emoji} ${mode.name} — ${mode.description}`.slice(0, 100), value: id });
               return option;
            }),
      )
      .addSubcommand((sub) =>
         sub
            .setName('trial')
            .setDescription('Climb the Spire ladder — fight the next PvE champion. Real wounds, a reward for each win.')
            .addStringOption((option) => {
               option.setName('opponent').setDescription('Rematch a champion you have already beaten (no reward). Omit to fight the next.');
               for (const champion of SPIRE_LADDER)
                  option.addChoices({ name: `${champion.name}, ${champion.title}`.slice(0, 100), value: champion.id });
               return option;
            }),
      ),
   category: 'game',
   async execute(client, interaction) {
      const sub = interaction.options.getSubcommand();
      if (sub === 'duel') return challengeToDuel(interaction);
      if (sub === 'trial') return runTrial(client, interaction);

      await runSparring(client, interaction);
   },
} satisfies SlashCommand;

// --- Sparring (for-fun, D16) ---------------------------------------------------

async function runSparring(client: ToscheClient, interaction: ChatInputCommandInteraction): Promise<void> {
   const challenger = interaction.user;
   const opponent = interaction.options.getUser('opponent', true);

   if (!interaction.guild) {
      await interaction.reply({ content: 'Fights happen on the server, not in DMs.', ...ephemeral });
      return;
   }
   if (opponent.bot) {
      await interaction.reply({ content: 'You cannot spar against a machine.', ...ephemeral });
      return;
   }
   if (opponent.id === challenger.id) {
      await interaction.reply({ content: 'You cannot spar against yourself, soldier.', ...ephemeral });
      return;
   }

   const spire = resolveGuildChannel(interaction.guild, settings.channels.smackdownSpire);
   if (!spire?.isSendable()) {
      await interaction.reply({ content: SPIRE_MISSING, ...ephemeral });
      return;
   }

   // Sparring fights the players' *active characters* (D16: no approval needed).
   const [c1, c2] = await Promise.all([
      accountService.getActiveCharacter(challenger.id, challenger.displayName),
      accountService.getActiveCharacter(opponent.id, opponent.displayName),
   ]);

   if (!c1 || !c2) {
      await interaction.reply({ content: 'One of you has no active character.', ...ephemeral });
      return;
   }

   // Acknowledge privately; the fight itself plays out in the Spire channel.
   await interaction.reply({ content: `⚔️ To the Spire — <#${spire.id}>!`, ...ephemeral });

   // Lock both *characters* for the whole match (first real runExclusive consumer).
   await client.locks.runExclusive([c1._id, c2._id], async () => {
      // The pre-lock reads were validation only. This fight may have queued
      // behind another one, so re-read the authoritative docs under the lock.
      const [fighter1, fighter2] = await Promise.all([
         characterService.get(c1._id),
         characterService.get(c2._id),
      ]);

      if (!fighter1 || !fighter2) {
         await interaction.followUp({ content: 'One of the fighters vanished before the bell.', ...ephemeral });
         return;
      }

      const f1 = { id: fighter1._id, stats: combatStatsFromCharacter(fighter1) };
      const f2 = { id: fighter2._id, stats: combatStatsFromCharacter(fighter2) };
      const names = { [f1.id]: f1.stats.name, [f2.id]: f2.stats.name };

      // Sparring is a fantasy match: it computes a winner + Elo, it does NOT
      // persist HP. The whole fight is decided in memory up front, then
      // narrated round by round for suspense; only Elo is committed, at the end.
      const result = simulateFight(f1, f2);

      await narrateFight(spire, result.rounds, names);

      const winnerId = result.winnerId;
      const loserId = result.loserId;
      const elo = await smackdownService.recordResult(
         { characterId: winnerId, characterName: names[winnerId] },
         { characterId: loserId, characterName: names[loserId] },
      );

      await spire.send(
         `🏆 **${names[winnerId]}** wins!\n${randomItem(FINISH_GIFS)}\n\n` +
         `**${names[winnerId]}** +${elo.change} → **${elo.winnerRating}** ELO\n` +
         `**${names[loserId]}** −${elo.change} → **${elo.loserRating}** ELO`,
      );
   });
}

async function narrateFight(channel: SendableChannels, rounds: RoundEvent[], names: Record<string, string>): Promise<void> {
   const [a, b] = Object.values(names);
   await channel.send(`⚔️ **${a}** challenges **${b}** to a sparring match!\n${randomItem(START_GIFS)}`);
   await sleep(INTRO_DELAY_MS);

   for (const round of rounds) {
      await channel.send(renderRound(round, names));
      await sleep(ROUND_DELAY_MS);
   }
}

// --- Duel (real stakes, consent-gated — D16/combat.md) -------------------------

/** Validates the matchup, then posts the consent card to the Spire. The fight
 *  itself starts only when the challenged player clicks Accept — the `duel`
 *  component handler owns the resolution + HP persistence. */
async function challengeToDuel(interaction: ChatInputCommandInteraction): Promise<void> {
   const challengerUser = interaction.user;
   const opponentUser = interaction.options.getUser('opponent', true);

   if (!interaction.guild) {
      await interaction.reply({ content: 'Duels are fought on the server, not in DMs.', ...ephemeral });
      return;
   }
   if (opponentUser.bot) {
      await interaction.reply({ content: 'You cannot duel a machine.', ...ephemeral });
      return;
   }
   if (opponentUser.id === challengerUser.id) {
      await interaction.reply({ content: 'You cannot duel yourself, soldier.', ...ephemeral });
      return;
   }

   const spire = resolveGuildChannel(interaction.guild, settings.channels.smackdownSpire);
   if (!spire?.isSendable()) {
      await interaction.reply({ content: SPIRE_MISSING, ...ephemeral });
      return;
   }

   // Duel uses the players' active characters; peek the opponent's so a mere
   // challenge never creates an account for them.
   const [challenger, opponent] = await Promise.all([
      accountService.getActiveCharacter(challengerUser.id, challengerUser.displayName),
      accountService.peekActiveCharacter(opponentUser.id),
   ]);

   if (!challenger) {
      await interaction.reply({ content: 'You have no active character to fight with.', ...ephemeral });
      return;
   }
   if (!opponent) {
      await interaction.reply({ content: `**${opponentUser.displayName}** has no active character to answer with.`, ...ephemeral });
      return;
   }

   // A duel needs an APPROVED, healthy character on both sides (D16). The consent
   // handler re-checks under the lock; this is the early, friendly rejection.
   const problem = actProblem(challenger, 'Your character') ?? actProblem(opponent, `**${displayName(opponent)}**`);
   if (problem) {
      await interaction.reply({ content: problem, ...ephemeral });
      return;
   }

   // The chosen bout ruleset (loadout etc.) rides in the card + the buttons so the
   // challenged player consents to it; `boutMode` normalises an absent/stale pick.
   const mode = boutMode(interaction.options.getString('mode') ?? DEFAULT_BOUT_MODE);

   await spire.send({
      content: `<@${opponentUser.id}>`,
      embeds: [buildChallengeCard(challenger, opponent, mode)],
      components: [buildChallengeButtons(challenger._id, opponent._id, mode.id)],
      allowedMentions: { users: [opponentUser.id] },
   });
   await interaction.reply({ content: `⚔️ Your challenge is laid down in <#${spire.id}>.`, ...ephemeral });
}

/** A message for why `subject` cannot duel, or null. Wraps the shared act gate. */
function actProblem(character: CharacterDoc, subject: string): string | null {
   const act = canCharacterAct(character);
   if (act.ok)
      return null;

   return act.reason === 'not-approved'
      ? `${subject} must be recognized by the Imperator before a real duel.`
      : `${subject} is in no shape to fight right now.`;
}

// --- Trial (PvE Spire ladder — D37) --------------------------------------------

/** Fights the active character against their next unbeaten ladder champion. Real
 *  stakes: only the PLAYER's Health is spent/persisted (the champion is a code
 *  stat block, not a character). A win advances the rung once and pays its reward. */
async function runTrial(client: ToscheClient, interaction: ChatInputCommandInteraction): Promise<void> {
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

   const problem = actProblem(character, 'Your character');
   if (problem) {
      await interaction.reply({ content: problem, ...ephemeral });
      return;
   }

   // Resolve the opponent — a named rematch, or the next unbeaten climb. Peek
   // pre-lock for a friendly message; re-resolve authoritatively under the lock.
   const requestedId = interaction.options.getString('opponent');
   const record = await smackdownService.getOrCreate(character._id, displayName(character));
   const preview = trialFightable(trialTarget(requestedId, record.trialRung ?? 0));
   if ('reason' in preview) {
      await interaction.reply({ content: preview.reason, ...ephemeral });
      return;
   }

   await interaction.reply({
      content: `⚔️ To the Spire — <#${spire.id}>! ${preview.isRematch ? 'A rematch against' : 'Your next challenger:'} **${preview.champion.name}, ${preview.champion.title}**.`,
      ...ephemeral,
   });

   await client.locks.runExclusive([character._id], async () => {
      const fighter = await characterService.get(character._id);
      if (!fighter) {
         await spire.send('The challenger never showed — the bout is off.');
         return;
      }

      const act = canCharacterAct(fighter);
      if (!act.ok) {
         await spire.send(`**${displayName(fighter)}** is in no shape to fight the ladder right now.`);
         return;
      }
      if (await activitySessionService.getActiveForParticipant(fighter._id)) {
         await spire.send(`**${displayName(fighter)}** is occupied elsewhere — the ladder can wait.`);
         return;
      }

      // Re-resolve under the lock (authoritative — a concurrent trial can't
      // double-advance or re-award; getOrCreate is idempotent).
      const rung = (await smackdownService.getOrCreate(fighter._id, displayName(fighter))).trialRung ?? 0;
      const target = trialFightable(trialTarget(requestedId, rung));
      if ('reason' in target) {
         await spire.send(target.reason);
         return;
      }
      const { champion: champ, isRematch } = target;

      const player = combatProfile(fighter); // trials are fought as-equipped
      const foe = championProfile(champ);
      const names = { [player.characterId]: player.name, [foe.characterId]: foe.name };

      const result = resolveDuel(player, foe);

      await spire.send({ content: buildTrialOpening(player.name, champ, isRematch), allowedMentions: { parse: [] } });
      await sleep(INTRO_DELAY_MS);
      for (const blow of result.blows) {
         await spire.send({ content: renderBlow(blow, names), allowedMentions: { parse: [] } });
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

      await spire.send({
         content: buildTrialResult({
            won, champion: champ, playerName: player.name, playerHp, playerMaxHp: player.maxHealth,
            rungBeaten: target.rung, ladderLength: LADDER_LENGTH, rewardCoins, ladderCleared, isRematch,
         }),
         allowedMentions: { parse: [] },
      });

      await postChronicle(client, chronicleTrialLine(displayName(fighter), champ.name, won, isRematch, rung));
   });
}

/** Turns a resolved trial target into a fightable champion, or a refusal reason
 *  (nothing left to climb, or a champion not yet earned). */
function trialFightable(target: TrialTarget): { champion: SpireChampion; rung: number; isRematch: boolean } | { reason: string } {
   if (target.kind === 'cleared')
      return { reason: `You have already bested every fighter in the Spire (${LADDER_LENGTH}/${LADDER_LENGTH}). None remain to challenge you, champion.` };
   if (target.kind === 'locked')
      return { reason: `You have not earned a bout with **${target.champion.name}** yet — climb the ladder to them first (\`/smackdown trial\` with no opponent).` };

   return { champion: target.champion, rung: target.rung, isRematch: target.kind === 'rematch' };
}

function chronicleTrialLine(name: string, championName: string, won: boolean, isRematch: boolean, rung: number): string {
   if (!won)
      return `🏟️ **${name}** was knocked out by **${championName}** ${isRematch ? 'in a Spire rematch' : 'on the Spire ladder'}.`;
   if (isRematch)
      return `🏟️ **${name}** won a friendly rematch against **${championName}** at the Spire.`;

   return `🏟️ **${name}** bested **${championName}** and climbed to rung ${rung + 1}/${LADDER_LENGTH} of the Spire ladder.`;
}

const SPIRE_MISSING = 'The Spire is missing. Set `channels.smackdownSpire` in settings to a real channel.';
