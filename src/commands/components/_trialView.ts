import { FINISH_GIFS, START_GIFS } from '../../game/combat/flavor.js';
import { healthBar } from './_duelView.js';
import { randomItem } from '../../lib/random.js';
import type { SpireChampion } from '../../game/combat/spireLadder.js';

// Narration for the PvE Spire ladder (`/smackdown trial`, D37). Pure strings; the
// per-blow lines reuse the duel's `renderBlow`, so a trial reads like any bout —
// only the framing (a named champion, a rung, a reward) differs.

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
