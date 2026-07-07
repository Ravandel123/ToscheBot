import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction, type SendableChannels } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { settings } from '../../../settings.js';
import { accountService } from '../../../db/services/accountService.js';
import { characterService } from '../../../db/services/characterService.js';
import { smackdownService } from '../../../db/services/smackdownService.js';
import { combatStatsFromCharacter } from '../../../game/combat/stats.js';
import { simulateFight, type RoundEvent } from '../../../game/combat/engine.js';
import { LADDER_LENGTH } from '../../../game/combat/spireLadder.js';
import { COMBAT_MOVES, HIT_LOCATIONS, START_GIFS, FINISH_GIFS } from '../../../game/combat/flavor.js';
import { canCharacterAct } from '../../../game/character/rules.js';
import { displayName } from '../../../game/character/identity.js';
import { DEFAULT_BOUT_MODE, boutMode, selectableBoutModes } from '../../../game/combat/bouts.js';
import { buildChallengeButtons, buildChallengeCard } from '../../components/_duelView.js';
import { buildTrialBrowser } from '../../components/_trialView.js';
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
            .setDescription('Climb the Spire ladder — browse PvE champions and pick your next bout.'),
      ),
   category: 'game',
   async execute(client, interaction) {
      const sub = interaction.options.getSubcommand();
      if (sub === 'duel') return challengeToDuel(interaction);
      if (sub === 'trial') return openTrial(interaction);

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

/** Opens the browsable Spire-ladder panel (the fight itself is owned by the
 *  `trial` component handler). This replaced the old `opponent:<name>` argument:
 *  the player now scrolls the roster and clicks Fight, so a bare `/smackdown
 *  trial` always works and no invalid champion name can reach the engine. */
async function openTrial(interaction: ChatInputCommandInteraction): Promise<void> {
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

   const record = await smackdownService.getOrCreate(character._id, displayName(character));
   const clearedRung = record.trialRung ?? 0;
   // Open on the next champion they still have to beat (clamped to the top rung
   // once the ladder is fully cleared).
   const startIndex = Math.min(clearedRung, LADDER_LENGTH - 1);

   await interaction.reply({ ...buildTrialBrowser(clearedRung, startIndex), ...ephemeral });
}

const SPIRE_MISSING = 'The Spire is missing. Set `channels.smackdownSpire` in settings to a real channel.';
