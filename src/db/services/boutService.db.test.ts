import { describe, expect, it } from 'vitest';
import { boutService } from './boutService.js';
import { characterService } from './characterService.js';
import { SmackdownRecord } from '../models/smackdownRecord.js';
import { combatProfile } from '../../game/combat/profile.js';
import { SPIRE_LADDER, championProfile } from '../../game/combat/spireLadder.js';
import { useTestDb } from '../../testing/memoryDb.js';
import type { CombatProfile, DuelResult } from '../../game/combat/duel.js';

// The bout commit is the one place a fight's consequences are written. These
// tests pin what must be on disk once it returns — before any narration runs.
useTestDb();

async function fighter(ownerId: string, name: string): Promise<CombatProfile> {
   const created = await characterService.create(ownerId, { name, race: 'canid', gender: 'male' });
   return combatProfile(created);
}

function outcome(winner: CombatProfile, loser: CombatProfile, loserHealth: number): DuelResult {
   return {
      winnerId: winner.characterId,
      loserId: loser.characterId,
      blows: [],
      finalHealth: { [winner.characterId]: winner.health - 2, [loser.characterId]: loserHealth },
      knockout: loserHealth === 0,
      openingStyles: {},
      stylesUsed: {},
   };
}

describe('boutService.commitDuel', () => {
   it('persists damage, learning and the win/loss record for both fighters', async () => {
      const a = await fighter('user-a', 'Ansel');
      const b = await fighter('user-b', 'Brock');

      await boutService.commitDuel(a, b, outcome(a, b, 0));

      const [storedA, storedB] = await Promise.all([characterService.get(a.characterId), characterService.get(b.characterId)]);
      expect(storedA!.resources.health.current).toBe(a.health - 2);
      expect(storedB!.resources.health.current).toBe(0);
      // An even fight credits a use to the attack path of both.
      expect(Object.keys(storedA!.progression.skills).length).toBeGreaterThan(0);
      expect(Object.keys(storedB!.progression.skills).length).toBeGreaterThan(0);

      expect(await SmackdownRecord.findById(a.characterId).lean()).toMatchObject({ duelWins: 1, duelLosses: 0 });
      expect(await SmackdownRecord.findById(b.characterId).lean()).toMatchObject({ duelWins: 0, duelLosses: 1 });
   });
});

describe('boutService.commitTrial', () => {
   const champion = championProfile(SPIRE_LADDER[0]);

   it('pays the reward and advances the rung on a fresh climb win', async () => {
      const player = await fighter('user-a', 'Ansel');

      const commit = await boutService.commitTrial(player, champion, outcome(player, champion, 0), { rung: 0, coins: 20 });

      expect(commit).toMatchObject({ won: true, rewardCoins: 20 });
      expect((await characterService.get(player.characterId))!.currencies.deltradaCoins).toBe(20);
      expect((await SmackdownRecord.findById(player.characterId).lean())?.trialRung).toBe(1);
   });

   it('pays nothing and keeps the rung on a loss', async () => {
      const player = await fighter('user-a', 'Ansel');

      const commit = await boutService.commitTrial(player, champion, outcome(champion, player, 0), { rung: 0, coins: 20 });

      expect(commit).toMatchObject({ won: false, rewardCoins: 0 });
      const stored = await characterService.get(player.characterId);
      expect(stored!.currencies.deltradaCoins).toBe(0);
      expect(stored!.resources.health.current).toBe(0);
      expect(await SmackdownRecord.findById(player.characterId).lean()).toBeNull();
   });

   it('pays nothing on a rematch win', async () => {
      const player = await fighter('user-a', 'Ansel');

      const commit = await boutService.commitTrial(player, champion, outcome(player, champion, 0), null);

      expect(commit).toMatchObject({ won: true, rewardCoins: 0 });
      expect((await characterService.get(player.characterId))!.currencies.deltradaCoins).toBe(0);
   });
});
