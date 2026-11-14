import { characterService } from './characterService.js';
import { smackdownService } from './smackdownService.js';
import { trainingNodes, trainingWeight } from '../../game/combat/training.js';
import type { CombatProfile, DuelResult } from '../../game/combat/duel.js';
import type { SkillLevelUp } from '../../game/character/skills.js';

// Persists everything a resolved bout changes, in one place and BEFORE the
// fight is narrated: a restart during the 30–45 s of narration must not undo a
// fight whose outcome was already decided. Callers hold the fighters' locks.
//
// The writes are separate atomic updates, not a transaction. Order is chosen so
// an interruption never costs a player something already earned: damage first
// (the cost), then learning, then rewards and records.

async function applyDamage(profile: CombatProfile, result: DuelResult): Promise<void> {
   const delta = result.finalHealth[profile.characterId] - profile.health;
   if (delta !== 0)
      await characterService.applyResourceDeltas(profile.characterId, { health: delta });
}

/** Both fighters train the paths they actually fought in, win or lose, weighted
 *  by how dangerous the other one was. */
function creditFighter(self: CombatProfile, foe: CombatProfile, result: DuelResult): Promise<SkillLevelUp[]> {
   const nodes = trainingNodes(self, result.stylesUsed[self.characterId] ?? []);
   return characterService.creditSkillUse(self.characterId, nodes, trainingWeight(self, foe));
}

export interface TrialClimb {
   /** The rung being fought (0-based); a win advances progress to `rung + 1`. */
   rung: number;
   coins: number;
}

export interface TrialCommit {
   won: boolean;
   levelUps: SkillLevelUp[];
   /** Coins actually paid (0 on a loss or a rematch). */
   rewardCoins: number;
}

export const boutService = {
   /** A real duel between two characters: damage, learning and the win/loss
    *  record for both. Returns each fighter's rank-ups, keyed by character id. */
   async commitDuel(a: CombatProfile, b: CombatProfile, result: DuelResult): Promise<Record<string, SkillLevelUp[]>> {
      await Promise.all([applyDamage(a, result), applyDamage(b, result)]);

      const levelUps = {
         [a.characterId]: await creditFighter(a, b, result),
         [b.characterId]: await creditFighter(b, a, result),
      };

      const names = { [a.characterId]: a.name, [b.characterId]: b.name };
      await smackdownService.recordDuel(
         { characterId: result.winnerId, characterName: names[result.winnerId] },
         { characterId: result.loserId, characterName: names[result.loserId] },
      );

      return levelUps;
   },

   /** A Spire-ladder bout: only the player is a real character. `climb` is set
    *  for a first attempt at a rung and null for a rematch (which pays nothing).
    *  Coins are paid before the rung advances, so an interruption between the
    *  two can never leave a cleared rung without its reward. */
   async commitTrial(player: CombatProfile, champion: CombatProfile, result: DuelResult, climb: TrialClimb | null): Promise<TrialCommit> {
      await applyDamage(player, result);
      const levelUps = await creditFighter(player, champion, result);

      const won = result.winnerId === player.characterId;
      let rewardCoins = 0;
      if (won && climb) {
         rewardCoins = climb.coins;
         await characterService.applyCurrencyDeltas(player.characterId, { deltradaCoins: rewardCoins });
         await smackdownService.advanceTrial(player.characterId, player.name, climb.rung + 1);
      }

      return { won, levelUps, rewardCoins };
   },
};
