import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '../../../types/commands.js';
import { config } from '../../../config.js';
import { settings } from '../../../settings.js';
import { accountService } from '../../../db/services/accountService.js';
import { smackdownService } from '../../../db/services/smackdownService.js';
import { LADDER_LENGTH } from '../../../game/combat/spireLadder.js';
import { canCharacterAct } from '../../../game/character/rules.js';
import { displayName } from '../../../game/character/identity.js';
import { DEFAULT_BOUT_MODE, boutMode, selectableBoutModes } from '../../../game/combat/bouts.js';
import { CHALLENGE_COOLDOWN_SECONDS, pendingChallenges } from '../../../game/combat/pendingChallenges.js';
import { buildChallengeButtons, buildChallengeCard } from '../../components/_duelView.js';
import { buildTrialBrowser } from '../../components/_trialView.js';
import { resolveGuildChannel } from '../../../lib/discord.js';
import type { CharacterDoc } from '../../../db/models/character.js';
import type { ToscheClient } from '../../../client.js';

const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export default {
   // `duel` — an approved character, real Health that is spent and persists, a
   // knockout at 0, and the target must consent by button. `trial` — the PvE
   // ladder. (The for-fun brawl is the prefix command `h!sparring`.)
   data: new SlashCommandBuilder()
      .setName('smackdown')
      .setDescription('Brawls in the Smackdown Spire.')
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
      if (interaction.options.getSubcommand() === 'trial')
         return openTrial(interaction);

      await challengeToDuel(client, interaction);
   },
} satisfies SlashCommand;

// --- Duel (real stakes, consent-gated — D16/combat.md) -------------------------

/** Validates the matchup, then posts the consent card to the Spire. The fight
 *  itself starts only when the challenged player clicks Accept — the `duel`
 *  component handler owns the resolution + HP persistence. */
async function challengeToDuel(client: ToscheClient, interaction: ChatInputCommandInteraction): Promise<void> {
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

   // Spam guard (D59): one unanswered challenge per target, and a pause between
   // a challenger's own challenges. Checked last, so a refused attempt above
   // never burns the cooldown. The owner skips the cooldown, as everywhere.
   const waiting = pendingChallenges.waitingOn(opponent._id);
   if (waiting) {
      await interaction.reply({ content: `**${displayName(opponent)}** still has a challenge from **${waiting}** to answer. One gauntlet at a time.`, ...ephemeral });
      return;
   }

   const wait = challengerUser.id === config.ownerId ? 0 : client.cooldowns.use('duel-challenge', challengerUser.id, CHALLENGE_COOLDOWN_SECONDS);
   if (wait > 0) {
      await interaction.reply({ content: `You only just threw down a gauntlet. Try again in ${Math.ceil(wait)}s.`, ...ephemeral });
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
   pendingChallenges.note(opponent._id, displayName(challenger));
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
