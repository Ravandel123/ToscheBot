import { PrefixCommand } from '../../../types/commands.js';
import { settings } from '../../../settings.js';
import { resolveGuildChannel } from '../../../lib/discord.js';
import { randomInt, randomItem } from '../../../lib/random.js';
import { sleep } from '../../../lib/async.js';
import { simulateFight, type Fighter, type RoundEvent } from '../../../game/combat/engine.js';
import type { CombatStats } from '../../../game/combat/stats.js';
import { COMBAT_MOVES, HIT_LOCATIONS, START_GIFS, FINISH_GIFS } from '../../../game/combat/flavor.js';

// TEMPORARY throwback command: the old bot's silly, no-stakes smackdown-spire
// brawl, ported as a plain prefix command. No Elo/ranking, no character stats —
// just two members and made-up numbers for the bit. Delete once the real
// `/smackdown` flow grows a for-fun mode people actually prefer.

const INTRO_DELAY_MS = 1500;
const ROUND_DELAY_MS = 1300;

function randomCombatStats(name: string): CombatStats {
   return {
      name,
      maxHp: randomInt(30, 50),
      attackBonus: randomInt(1, 6),
      defenseBonus: randomInt(1, 6),
      strengthBonus: randomInt(1, 4),
      consitutionBonus: randomInt(1, 4),
   };
}

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
   name: 'sparring',
   aliases: ['smackdown', 'sd'],
   description: "Tosch throws you into the Smackdown Spire for a silly, no-stakes brawl.",
   usage: '@opponent',
   category: 'fun',
   async execute(message) {
      if (!message.guild) {
         await message.reply('Fights happen on the server, not in DMs.');
         return;
      }

      const opponent = message.mentions.users.first();
      if (!opponent) {
         await message.reply('Tag someone to spar against, soldier!');
         return;
      }
      if (opponent.bot) {
         await message.reply('You cannot spar against a machine.');
         return;
      }
      if (opponent.id === message.author.id) {
         await message.reply('You cannot spar against yourself, soldier.');
         return;
      }

      const spire = resolveGuildChannel(message.guild, settings.channels.smackdownSpire);
      if (!spire?.isSendable()) {
         await message.reply(`The Spire is missing. Set \`channels.smackdownSpire\` in settings to a real channel.`);
         return;
      }

      await message.reply(`⚔️ To the Spire — <#${spire.id}>!`);

      const challengerName = message.member?.displayName ?? message.author.username;
      const opponentName = message.mentions.members?.first()?.displayName ?? opponent.username;

      const f1: Fighter = { id: message.author.id, stats: randomCombatStats(challengerName) };
      const f2: Fighter = { id: opponent.id, stats: randomCombatStats(opponentName) };
      const names = { [f1.id]: f1.stats.name, [f2.id]: f2.stats.name };

      const result = simulateFight(f1, f2);

      await spire.send(`⚔️ **${challengerName}** challenges **${opponentName}** to a sparring match!\n${randomItem(START_GIFS)}`);
      await sleep(INTRO_DELAY_MS);

      for (const round of result.rounds) {
         await spire.send(renderRound(round, names));
         await sleep(ROUND_DELAY_MS);
      }

      await spire.send(`🏆 **${names[result.winnerId]}** wins!\n${randomItem(FINISH_GIFS)}`);
   },
} satisfies PrefixCommand;
