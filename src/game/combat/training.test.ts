import { describe, expect, it } from 'vitest';
import { MAX_TRAINING_WEIGHT, combatPower, trainingNodes, trainingWeight } from './training.js';
import { SPIRE_LADDER, championProfile } from './spireLadder.js';
import type { CombatProfile } from './duel.js';

function profile(overrides: Partial<CombatProfile> = {}): CombatProfile {
   return {
      characterId: 'x',
      name: 'x',
      maxHealth: 20,
      health: 20,
      attackTarget: 50,
      attackNode: 'striking',
      defenseTarget: 40,
      damage: { min: 3, max: 3 },
      damageType: 'impact',
      strengthBonus: 0,
      soak: 0,
      initiative: 5,
      family: 'unarmed',
      ...overrides,
   };
}

/** Roughly the top of the Spire — far above the base test profile. */
const monster = profile({ attackTarget: 95, defenseTarget: 95, damage: { min: 10, max: 14 }, strengthBonus: 5, soak: 7, maxHealth: 30 });

describe('combatPower', () => {
   it('climbs monotonically up the Spire ladder (each rung reads as stronger)', () => {
      const powers = SPIRE_LADDER.map((champion) => combatPower(championProfile(champion)));
      for (let i = 1; i < powers.length; i++)
         expect(powers[i]).toBeGreaterThan(powers[i - 1]);
   });

   it('reads a wounded fighter at full menace (power is the build, not the HP left)', () => {
      expect(combatPower(profile({ health: 1 }))).toBe(combatPower(profile()));
   });
});

describe('trainingWeight', () => {
   it('is exactly 1 against an equal', () => {
      expect(trainingWeight(profile(), profile())).toBe(1);
   });

   it('grows with a stronger foe and caps at MAX_TRAINING_WEIGHT', () => {
      const somewhatStronger = profile({ attackTarget: 60, defenseTarget: 50 });
      const weight = trainingWeight(profile(), somewhatStronger);
      expect(weight).toBeGreaterThan(1);
      expect(weight).toBeLessThan(MAX_TRAINING_WEIGHT);

      expect(trainingWeight(profile(), monster)).toBe(MAX_TRAINING_WEIGHT);
   });

   it('fades against a weaker foe and hits 0 on a pushover (the anti-farm)', () => {
      const somewhatWeaker = profile({ attackTarget: 40, defenseTarget: 30 });
      const weight = trainingWeight(profile(), somewhatWeaker);
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThan(1);

      // The monster looking down at the base profile: under half its power.
      expect(trainingWeight(monster, profile())).toBe(0);
   });

   it('teaches the underdog more than the favourite in the same bout', () => {
      const underdog = profile();
      const favourite = profile({ attackTarget: 65, defenseTarget: 50, soak: 3 });
      expect(trainingWeight(underdog, favourite)).toBeGreaterThan(trainingWeight(favourite, underdog));
   });
});

describe('trainingNodes', () => {
   it('trains the base attack node for a plain bout (no styles used)', () => {
      expect(trainingNodes(profile(), [])).toEqual(['striking']);
      expect(trainingNodes(profile(), [null])).toEqual(['striking']);
   });

   it('trains the style branch you actually fought in, not the base one', () => {
      // A whole bout in Grappler banks nothing into Striking (D41).
      expect(trainingNodes(profile(), ['grappler'])).toEqual(['grappling']);
   });

   it('trains every distinct style of a plan-switching bout', () => {
      expect(trainingNodes(profile(), ['striker', 'stonewall'])).toEqual(['striking', 'guard']);
   });

   it('keeps an armed fighter training the weapon branch under any style', () => {
      const armed = profile({ family: 'one_handed', attackNode: 'one_handed' });
      expect(trainingNodes(armed, ['warden'])).toEqual(expect.arrayContaining(['warding', 'one_handed']));
   });
});
