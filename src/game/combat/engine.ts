import { randomInt } from '../../lib/random.js';
import type { CombatStats } from './stats.js';

export interface Fighter {
   id: string;
   stats: CombatStats;
}

export interface RoundEvent {
   attackerId: string;
   defenderId: string;
   hit: boolean;
   damage: number;
   defenderHpAfter: number;
}

export interface FightResult {
   winnerId: string;
   loserId: string;
   rounds: RoundEvent[];
}

// Safety cap so a low-damage matchup can't loop forever; if reached, the
// fighter with more HP left wins (tie broken by who struck last).
const MAX_ROUNDS = 25;

/**
 * Auto-resolves a sparring match. Pure except for randomness (mock `Math.random`
 * to test deterministically). Each round: the attacker rolls d20 + attackBonus
 * vs the defender's d20 + defenseBonus; on a hit, damage scales with strength,
 * how cleanly the attack landed, and the defender's consitution.
 */
export function simulateFight(a: Fighter, b: Fighter): FightResult {
   const hp: Record<string, number> = { [a.id]: a.stats.maxHp, [b.id]: b.stats.maxHp };
   const rounds: RoundEvent[] = [];

   // Roll initiative.
   let attacker = randomInt(0, 1) === 0 ? a : b;
   let defender = attacker.id === a.id ? b : a;

   for (let round = 0; round < MAX_ROUNDS && hp[a.id] > 0 && hp[b.id] > 0; round++) {
      const attackRoll = randomInt(1, 20) + attacker.stats.attackBonus;
      const defenseRoll = randomInt(1, 20) + defender.stats.defenseBonus;
      let damage = 0;

      if (attackRoll >= defenseRoll) {
         const cleanliness = Math.floor((attackRoll - defenseRoll) / 5);
         damage = Math.max(1, attacker.stats.strengthBonus + randomInt(1, 4) + cleanliness - defender.stats.consitutionBonus);
         hp[defender.id] -= damage;
      }

      rounds.push({
         attackerId: attacker.id,
         defenderId: defender.id,
         hit: damage > 0,
         damage,
         defenderHpAfter: Math.max(0, hp[defender.id]),
      });

      [attacker, defender] = [defender, attacker];
   }

   // `attacker` is now whoever would act next; the last striker was `defender`.
   const winnerId = hp[a.id] === hp[b.id]
      ? defender.id
      : hp[a.id] > hp[b.id] ? a.id : b.id;
   const loserId = winnerId === a.id ? b.id : a.id;

   return { winnerId, loserId, rounds };
}
