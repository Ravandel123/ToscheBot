import { SlashCommandBuilder, MessageFlags, type SendableChannels } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { settings } from '../../../settings.js';
import { accountService } from '../../../db/services/accountService.js';
import { characterService } from '../../../db/services/characterService.js';
import { smackdownService } from '../../../db/services/smackdownService.js';
import { combatStatsFromCharacter } from '../../../game/combat/stats.js';
import { simulateFight, type RoundEvent } from '../../../game/combat/engine.js';
import { COMBAT_MOVES, HIT_LOCATIONS, START_GIFS, FINISH_GIFS } from '../../../game/combat/flavor.js';
import { randomItem } from '../../../lib/random.js';
import { resolveGuildChannel } from '../../../lib/discord.js';
import { sleep } from '../../../lib/async.js';

// Pacing of the narrated fight, so it reads like a brawl rather than a wall of text.
const INTRO_DELAY_MS = 1500;
const ROUND_DELAY_MS = 1300;

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
   // `sparring` is the for-fun, no-stakes brawl (no character approval needed).
   // A future `duel` subcommand will be the serious, approval-gated, AP-costing fight.
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
      ),
   category: 'game',
   async execute(client, interaction) {
      const challenger = interaction.user;
      const opponent = interaction.options.getUser('opponent', true);

      if (!interaction.guild) {
         await interaction.reply({ content: 'Fights happen on the server, not in DMs.', flags: MessageFlags.Ephemeral });
         return;
      }
      if (opponent.bot) {
         await interaction.reply({ content: 'You cannot spar against a machine.', flags: MessageFlags.Ephemeral });
         return;
      }
      if (opponent.id === challenger.id) {
         await interaction.reply({ content: 'You cannot spar against yourself, soldier.', flags: MessageFlags.Ephemeral });
         return;
      }

      const spire = resolveGuildChannel(interaction.guild, settings.channels.smackdownSpire);
      if (!spire?.isSendable()) {
         await interaction.reply({
            content: `The Spire is missing. Set \`channels.smackdownSpire\` in settings to a real channel.`,
            flags: MessageFlags.Ephemeral,
         });
         return;
      }

      // Sparring fights the players' *active characters* (D16: no approval needed).
      const [c1, c2] = await Promise.all([
         accountService.getActiveCharacter(challenger.id, challenger.displayName),
         accountService.getActiveCharacter(opponent.id, opponent.displayName),
      ]);

      if (!c1 || !c2) {
         await interaction.reply({ content: 'One of you has no active character.', flags: MessageFlags.Ephemeral });
         return;
      }

      // Acknowledge privately; the fight itself plays out in the Spire channel.
      await interaction.reply({ content: `⚔️ To the Spire — <#${spire.id}>!`, flags: MessageFlags.Ephemeral });

      // Lock both *characters* for the whole match (first real runExclusive consumer).
      await client.locks.runExclusive([c1._id, c2._id], async () => {
         // The pre-lock reads were validation only. This fight may have queued
         // behind another one, so re-read the authoritative docs under the lock.
         const [fighter1, fighter2] = await Promise.all([
            characterService.get(c1._id),
            characterService.get(c2._id),
         ]);

         if (!fighter1 || !fighter2) {
            await interaction.followUp({ content: 'One of the fighters vanished before the bell.', flags: MessageFlags.Ephemeral });
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
   },
} satisfies SlashCommand;

async function narrateFight(channel: SendableChannels, rounds: RoundEvent[], names: Record<string, string>): Promise<void> {
   const [a, b] = Object.values(names);
   await channel.send(`⚔️ **${a}** challenges **${b}** to a sparring match!\n${randomItem(START_GIFS)}`);
   await sleep(INTRO_DELAY_MS);

   for (const round of rounds) {
      await channel.send(renderRound(round, names));
      await sleep(ROUND_DELAY_MS);
   }
}
