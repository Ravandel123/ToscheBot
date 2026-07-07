import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import { FINISH_GIFS, START_GIFS } from '../../game/combat/flavor.js';
import { LADDER_LENGTH, SPIRE_LADDER, trialTarget } from '../../game/combat/spireLadder.js';
import { healthBar } from './_duelView.js';
import { randomItem } from '../../lib/random.js';
import type { SpireChampion } from '../../game/combat/spireLadder.js';

// Views for the PvE Spire ladder (`/smackdown trial`, D37). Two surfaces:
//   1. `buildTrialBrowser` — an ephemeral, stateless "scroll the roster" panel
//      (like `/character view` / the comic browser): one champion at a time, prev/
//      next through the ladder, a Fight button live only for a climb or an earned
//      rematch. This REPLACED the old `opponent:<name>` command argument, so the
//      bot can no longer be handed an invalid/typo'd champion (the old crash) and a
//      bare `/smackdown trial` opens a real menu instead of guessing (TODO/General).
//   2. `buildTrialOpening`/`buildTrialResult` — the per-bout narration in the Spire
//      channel, reusing the duel's `renderBlow` so a trial reads like any bout.
//
// 🖼️ Champion portrait art is OPTIONAL (images.md): the panel is text-first and
// carries a placeholder footer until per-champion art exists — nothing here breaks
// when the picture is absent.

const SPIRE_COLOR = 0xB8860B; // spire brass
const PORTRAIT_PLACEHOLDER = '🖼️ Champion portrait — coming soon';

export interface TrialBrowser {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** The browsable ladder panel. Pure render — the caller supplies the viewer's
 *  cleared-rung progress (their next-unbeaten index) and which champion to show.
 *  `index` is clamped, so callers can pass raw prev/next arithmetic. */
export function buildTrialBrowser(clearedRung: number, indexInput: number): TrialBrowser {
   const index = clampIndex(indexInput);
   const champion = SPIRE_LADDER[index];
   const target = trialTarget(champion.id, clearedRung);
   const s = champion.stats;

   const status =
      target.kind === 'locked'
         ? '🔒 **Locked** — best the earlier champions to earn this bout.'
         : target.kind === 'rematch'
            ? '✅ **Cleared** — you may rematch (no reward, real wounds at stake).'
            : '⚔️ **Next challenger** — a win climbs the ladder and pays a reward.';

   const embed = new EmbedBuilder()
      .setColor(SPIRE_COLOR)
      .setTitle(`🏟️ Spire Ladder · Rung ${index + 1}/${LADDER_LENGTH}`)
      .setDescription(`**${champion.name}, ${champion.title}**\n_${champion.blurb}_`)
      .addFields(
         {
            name: 'Fighting stats',
            value:
               `❤️ Health **${s.maxHealth}** · 🛡️ Soak **${s.soak}**\n` +
               `⚔️ Attack **${s.attackTarget}** · 🤸 Defense **${s.defenseTarget}**\n` +
               `💥 Damage **${s.damage.min}–${s.damage.max}** ${s.damageType} · ⚡ Init **${s.initiative}**`,
         },
         { name: 'Reward (first clear)', value: `🪙 ${champion.reward.coins} Deltrada Coins`, inline: true },
         { name: 'Status', value: status, inline: true },
      )
      .setFooter({ text: PORTRAIT_PLACEHOLDER });

   return { embeds: [embed], components: [navRow(index), fightRow(champion, target.kind)] };
}

/** Repaints the panel once the player commits to a bout — buttons gone, pointing
 *  them to the Spire channel where the fight narrates. */
export function buildTrialSentOff(spireChannelId: string, champion: SpireChampion, isRematch: boolean): TrialBrowser {
   const embed = new EmbedBuilder()
      .setColor(SPIRE_COLOR)
      .setTitle('🏟️ To the Spire!')
      .setDescription(
         `${isRematch ? 'A rematch against' : 'Your bout with'} **${champion.name}, ${champion.title}** is underway in <#${spireChannelId}>.`,
      );

   return { embeds: [embed], components: [] };
}

function navRow(index: number): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`trial:show:${index - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
      new ButtonBuilder().setCustomId('trial:noop').setLabel(`${index + 1} / ${LADDER_LENGTH}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`trial:show:${index + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(index === LADDER_LENGTH - 1),
   );
}

function fightRow(champion: SpireChampion, kind: ReturnType<typeof trialTarget>['kind']): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const isRematch = kind === 'rematch';
   const canFight = kind === 'climb' || kind === 'rematch';

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
         .setCustomId(`trial:fight:${champion.id}`)
         .setLabel(kind === 'locked' ? 'Locked' : isRematch ? 'Rematch' : 'Fight')
         .setEmoji(kind === 'locked' ? '🔒' : '⚔️')
         .setStyle(isRematch ? ButtonStyle.Primary : ButtonStyle.Success)
         .setDisabled(!canFight),
   );
}

function clampIndex(input: number): number {
   const n = Math.trunc(input);
   if (!Number.isFinite(n) || n < 0)
      return 0;
   return Math.min(LADDER_LENGTH - 1, n);
}

// --- Bout narration (unchanged shape — reused by the fight orchestration) -------

export function buildTrialOpening(playerName: string, champion: SpireChampion, isRematch: boolean): string {
   const verb = isRematch ? 'squares off against' : 'steps up to face';
   const tag = isRematch ? ' _(a rematch — nothing on the line but pride)_' : '';
   return `🏟️ **${playerName}** ${verb} **${champion.name}, ${champion.title}**.${tag}\n_${champion.blurb}_\n${randomItem(START_GIFS)}`;
}

export interface TrialResultView {
   won: boolean;
   champion: SpireChampion;
   playerName: string;
   playerHp: number;
   playerMaxHp: number;
   /** 0-based rung just fought. */
   rungBeaten: number;
   ladderLength: number;
   rewardCoins: number;
   /** True when this win cleared the final rung. */
   ladderCleared: boolean;
   /** A re-fight of an already-beaten champion — no reward, no progress. */
   isRematch: boolean;
}

export function buildTrialResult(view: TrialResultView): string {
   const bar = healthBar(view.playerHp, view.playerMaxHp);

   // --- Rematch: real Health at stake, but no reward and no rung change. -------
   if (view.isRematch) {
      if (!view.won)
         return `💥 **${view.champion.name}** gets the better of **${view.playerName}** again — no shame in a friendly rematch.\n**${view.playerName}** ${bar}.`;

      return `🥊 **${view.playerName}** settles the score with **${view.champion.name}** — cleanly done.\n` +
         `${randomItem(FINISH_GIFS)}\nNo reward for a rematch, but the bragging rights are free. **${view.playerName}** ${bar}.`;
   }

   // --- Climb: the next unbeaten rung — rewards + progress. --------------------
   if (!view.won)
      return `💥 **${view.champion.name}** puts **${view.playerName}** down in the sawdust — the climb ends here for today.\n` +
         `**${view.playerName}** ${bar}. Heal up and come back for another go, no-no.`;

   const rungsDone = view.rungBeaten + 1;

   if (view.ladderCleared)
      return `🏆 **${view.playerName}** topples **${view.champion.name}** — and with that, **the whole Spire ladder is conquered** (${view.ladderLength}/${view.ladderLength})!\n` +
         `${randomItem(FINISH_GIFS)}\n🪙 **+${view.rewardCoins}** Deltrada Coins. No one is left to fight, champion — the Spire is yours.`;

   return `🏆 **${view.playerName}** beats **${view.champion.name}** and climbs to **rung ${rungsDone}/${view.ladderLength}**!\n` +
      `${randomItem(FINISH_GIFS)}\n🪙 **+${view.rewardCoins}** Deltrada Coins. **${view.playerName}** ${bar}.`;
}
