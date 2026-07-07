import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import { displayName } from '../../game/character/identity.js';
import { COMBAT_MOVES, HIT_LOCATIONS, FINISH_GIFS, START_GIFS } from '../../game/combat/flavor.js';
import { skillNode } from '../../game/data/skills.js';
import { randomItem } from '../../lib/random.js';
import type { BoutMode } from '../../game/combat/bouts.js';
import type { DuelBlow, DuelResult } from '../../game/combat/duel.js';
import type { SkillLevelUp } from '../../game/character/skills.js';
import type { CharacterDoc } from '../../db/models/character.js';

// Colocated Discord builders for the serious `/smackdown duel` (D16/combat.md
// R24). Pure of DB/lock work — the handler (duel.ts) owns the fight loop and the
// HP persistence; these just render the consent card and narrate each blow.
// START/FINISH_GIFS + COMBAT_MOVES/HIT_LOCATIONS are shared with sparring flavor.

const DUEL_COLOR = 0x8B2B2B; // dried blood
const HP_BAR_SEGMENTS = 10;

type CardView = { embeds: EmbedBuilder[]; components: [] };

/** The consent card posted to the Spire — real stakes need the target's yes
 *  (combat.md's locked consent rule). The `mode` (bout ruleset) is shown so the
 *  challenged player consents to THOSE rules, not just to a fight. */
export function buildChallengeCard(challenger: CharacterDoc, opponent: CharacterDoc, mode: BoutMode): EmbedBuilder {
   return new EmbedBuilder()
      .setColor(DUEL_COLOR)
      .setTitle('⚔️ A Duel is Called')
      .setDescription(
         `**${displayName(challenger)}** calls out **${displayName(opponent)}** for a real bout in the Spire.\n\n` +
         'This is no sparring match: **real wounds are dealt and do not mend at once**, and a fighter dropped to **0 Health is knocked cold** — out of the fight, but no worse for it (no lost Action Points, no lasting harm — you wake with a dented pride, no-no).',
      )
      .addFields(
         { name: `${mode.emoji} ${mode.name}`, value: mode.description, inline: false },
         { name: displayName(challenger), value: healthLine(challenger), inline: true },
         { name: displayName(opponent), value: healthLine(opponent), inline: true },
      )
      .setFooter({ text: 'Only the challenged may accept or decline.' });
}

export function buildChallengeButtons(challengerId: string, opponentId: string, modeId: string): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`duel:accept:${challengerId}:${opponentId}:${modeId}`).setLabel('Accept').setEmoji('⚔️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`duel:decline:${challengerId}:${opponentId}:${modeId}`).setLabel('Decline').setEmoji('🏳️').setStyle(ButtonStyle.Secondary),
   );
}

export function buildAcceptedCard(challenger: CharacterDoc, opponent: CharacterDoc): CardView {
   return {
      embeds: [new EmbedBuilder().setColor(DUEL_COLOR).setTitle('⚔️ Challenge Accepted')
         .setDescription(`**${displayName(opponent)}** answers **${displayName(challenger)}**. To the sand — no pulling blows now.`)],
      components: [],
   };
}

export function buildDeclinedCard(challengerName: string, opponentName: string): CardView {
   return {
      embeds: [new EmbedBuilder().setColor(DUEL_COLOR).setTitle('🏳️ Challenge Declined')
         .setDescription(`**${opponentName}** declines **${challengerName}**'s challenge. The sand stays quiet — this time.`)],
      components: [],
   };
}

export function buildCancelledCard(reason: string): CardView {
   return {
      embeds: [new EmbedBuilder().setColor(DUEL_COLOR).setTitle('⚔️ Duel Called Off').setDescription(reason)],
      components: [],
   };
}

// --- Narration ----------------------------------------------------------------

export function duelOpeningLine(challengerName: string, opponentName: string, mode: BoutMode): string {
   return `⚔️ **${challengerName}** and **${opponentName}** square off on the Spire sand — this one is for real.\n` +
      `**${mode.emoji} ${mode.name}** rules — ${mode.description}\n${randomItem(START_GIFS)}`;
}

/** One narrated exchange. Numbers stay backstage where they can; the HP note is
 *  the one figure worth showing so a watcher can feel the fight turning. */
export function renderBlow(blow: DuelBlow, names: Record<string, string>): string {
   const attacker = names[blow.attackerId] ?? 'A fighter';
   const defender = names[blow.defenderId] ?? 'their foe';
   const location = randomItem(HIT_LOCATIONS);

   if (!blow.hit)
      return `**${attacker}** goes for **${defender}**'s ${location} — turned aside!`;

   if (blow.defenderDowned)
      return `**${attacker}** ${randomItem(COMBAT_MOVES)} **${defender}**'s ${location} for **${blow.damage}** — and **${defender}** goes down! 💫`;

   return `**${attacker}** ${randomItem(COMBAT_MOVES)} **${defender}**'s ${location} for **${blow.damage}**! _(${defender}: ${blow.defenderHealthAfter} HP)_`;
}

/** The closing line: a knockout, or a points decision on the round cap. */
export function buildOutcomeLine(result: DuelResult, names: Record<string, string>, maxHealth: Record<string, number>): string {
   const winner = names[result.winnerId];
   const loser = names[result.loserId];
   const winnerHp = healthBar(result.finalHealth[result.winnerId], maxHealth[result.winnerId]);

   if (result.knockout)
      return `🏆 **${winner}** stands over **${loser}**, who is out cold in the sawdust.\n${randomItem(FINISH_GIFS)}\n` +
         `**${winner}** walks away — ${winnerHp}\n**${loser}** will wake with a headache and nothing worse, no-no.`;

   return `🏁 The bell ends it — **${winner}** takes the bout on points.\n` +
      `**${winner}** ${winnerHp} · **${loser}** ${healthBar(result.finalHealth[result.loserId], maxHealth[result.loserId])}. Both are bruised but standing.`;
}

/** The "you improved!" line after a Spire bout (skills.md: growth must announce
 *  itself) — only ranked-up nodes are named; a bout that only banked progress
 *  stays quiet. Shared by the duel and the trial. */
export function buildTrainingLine(name: string, levelUps: readonly SkillLevelUp[]): string {
   const gains = levelUps.map((up) => `**${skillNode(up.node).name}** rises to **${up.to}**`).join(', ');
   return `📈 The bout leaves its mark — **${name}**'s ${gains}.`;
}

// --- Small helpers -------------------------------------------------------------

function healthLine(character: CharacterDoc): string {
   const { current, max } = character.resources.health;
   return `❤️ ${healthBar(current, max)}`;
}

/** A 10-segment ❤ bar + `current/max`, shared by the duel + trial narration. */
export function healthBar(current: number, max: number): string {
   const safeMax = Math.max(1, max);
   const filled = Math.max(0, Math.min(HP_BAR_SEGMENTS, Math.round((current / safeMax) * HP_BAR_SEGMENTS)));
   return `${'█'.repeat(filled)}${'░'.repeat(HP_BAR_SEGMENTS - filled)} ${Math.max(0, current)}/${max}`;
}
