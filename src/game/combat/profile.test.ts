import { describe, expect, it } from 'vitest';
import { combatProfile, equippedWeapon, isDowned } from './profile.js';
import { attributeBonus } from './stats.js';
import type { CharacterDoc } from '../../db/models/character.js';

// A lean CharacterDoc with only the fields combatProfile reads (attributes,
// health, identity, inventory/equipment). Everything else is irrelevant here.
function character(overrides: Partial<CharacterDoc> = {}): CharacterDoc {
   return {
      _id: 'c1',
      identity: { name: 'Bruiser', epithet: '', race: null, gender: '', bio: '', avatarUrl: '' },
      attributes: { strength: 25, constitution: 30, agility: 40, dexterity: 25, charisma: 25, willpower: 25, perception: 20, intelligence: 25 },
      resources: { health: { current: 20, max: 20 }, stamina: { current: 10, max: 10 } },
      progression: { skills: {} },
      inventory: [],
      equipment: {},
      ...overrides,
   } as unknown as CharacterDoc;
}

describe('combatProfile', () => {
   it('derives an unarmed brawler from bare attributes and Health', () => {
      const p = combatProfile(character());

      expect(p.characterId).toBe('c1');
      expect(p.maxHealth).toBe(20);
      expect(p.health).toBe(20);
      expect(p.damage).toEqual({ min: 1, max: 3 }); // fists
      expect(p.damageType).toBe('impact');
      expect(p.soak).toBe(attributeBonus(30)); // ConstitutionBonus, no armour
      expect(p.initiative).toBe(attributeBonus(40) + attributeBonus(20)); // AGI + PER bonus
   });

   it('keeps the derived d100 targets inside the roll-under band', () => {
      const p = combatProfile(character());
      for (const target of [p.attackTarget, p.defenseTarget]) {
         expect(target).toBeGreaterThanOrEqual(5);
         expect(target).toBeLessThanOrEqual(95);
      }
      // Attack sits above defence so blows land and fights stay decisive.
      expect(p.attackTarget).toBeGreaterThan(p.defenseTarget);
   });

   it('arms the attack from the wielded main-hand weapon', () => {
      const armed = character({
         inventory: [{ instanceId: 'w1', itemId: 'iron_sword', quality: 'common', quantity: 1, durability: 60, acquiredAt: new Date() }],
         equipment: { mainHand: 'w1' },
      });

      expect(equippedWeapon(armed)?.name).toBe('Iron Sword');
      expect(combatProfile(armed).damage).toEqual({ min: 4, max: 9 });
      expect(combatProfile(armed).damageType).toBe('slash');
   });

   it('folds worn Armour Value into Soak', () => {
      const armoured = character({
         inventory: [{ instanceId: 'a1', itemId: 'leather_jerkin', quality: 'common', quantity: 1, durability: 50, acquiredAt: new Date() }],
         equipment: { chest: 'a1' },
      });

      // leather_jerkin AV 1 on top of ConstitutionBonus.
      expect(combatProfile(armoured).soak).toBe(attributeBonus(30) + 1);
   });

   it('resolves the style family from the hands: fists = unarmed, a weapon = its grip (D42)', () => {
      expect(combatProfile(character()).family).toBe('unarmed');

      const armed = character({
         inventory: [{ instanceId: 'w1', itemId: 'iron_sword', quality: 'common', quantity: 1, durability: 60, acquiredAt: new Date() }],
         equipment: { mainHand: 'w1' },
      });
      expect(combatProfile(armed).family).toBe('one_handed');

      const greatArmed = character({
         inventory: [{ instanceId: 'w2', itemId: 'war_maul', quality: 'common', quantity: 1, durability: 80, acquiredAt: new Date() }],
         equipment: { mainHand: 'w2' },
      });
      expect(combatProfile(greatArmed).family).toBe('two_handed');

      // Bare-knuckle strips the sword → the unarmed catalog (and plan) applies.
      expect(combatProfile(armed, { loadout: 'unarmed-unarmored' }).family).toBe('unarmed');
   });

   it('derives per-style targets for every style the combat plan references', () => {
      const planned = character({
         combatPlan: { unarmed: { style: 'striker', rules: [{ trigger: { kind: 'self-health-below', value: 50 }, style: 'stonewall' }] } },
      });
      const p = combatProfile(planned);

      expect(p.plan).toEqual({ style: 'striker', rules: [{ trigger: { kind: 'self-health-below', value: 50 }, style: 'stonewall' }] });
      expect(p.styleTargets?.striker).toBeDefined();
      expect(p.styleTargets?.stonewall).toBeDefined();
      expect(p.styleTargets?.grappler).toBeUndefined(); // unreferenced — not computed
   });

   it('rolls a trained style better on BOTH sides of the opposed test (the owner\'s rule)', () => {
      const plan = { unarmed: { style: 'stonewall' as const, rules: [] } };
      const novice = combatProfile(character({ combatPlan: plan }));
      const drilled = combatProfile(character({
         combatPlan: plan,
         progression: { skills: { guard: { points: 20, progress: 0 }, brawling: { points: 10, progress: 0 } } },
      }));

      const noviceTargets = novice.styleTargets?.stonewall;
      const drilledTargets = drilled.styleTargets?.stonewall;
      expect(drilledTargets?.attack ?? 0).toBeGreaterThan(noviceTargets?.attack ?? 0);
      expect(drilledTargets?.defense ?? 0).toBeGreaterThan(noviceTargets?.defense ?? 0);
   });

   it('drops a wrong-family plan instead of carrying it into the bout', () => {
      // A one-handed plan on a bare-fisted fighter: the unarmed family has no
      // plan stored, so the profile fights plain.
      const p = combatProfile(character({ combatPlan: { one_handed: { style: 'warden', rules: [] } } }));
      expect(p.plan).toEqual({ style: null, rules: [] });
      expect(p.styleTargets).toEqual({});
   });

   it('strips gear for a bare-knuckle loadout', () => {
      const kitted = character({
         inventory: [
            { instanceId: 'w1', itemId: 'iron_sword', quality: 'common', quantity: 1, durability: 60, acquiredAt: new Date() },
            { instanceId: 'a1', itemId: 'steel_breastplate', quality: 'common', quantity: 1, durability: 100, acquiredAt: new Date() },
         ],
         equipment: { mainHand: 'w1', chest: 'a1' },
      });

      const geared = combatProfile(kitted); // as-equipped
      const bare = combatProfile(kitted, { loadout: 'unarmed-unarmored' });

      // Weapon and armour vanish: fists, and Soak drops back to ConstitutionBonus.
      expect(bare.damage).toEqual({ min: 1, max: 3 });
      expect(bare.soak).toBe(attributeBonus(30));
      expect(geared.soak).toBe(attributeBonus(30) + 3); // breastplate AV 3
      // The breastplate's −10 AGI penalty applies geared, not bare — bare initiative
      // reads off the higher, unencumbered Agility.
      expect(bare.initiative).toBeGreaterThan(geared.initiative);
   });
});

describe('isDowned', () => {
   it('is true only at or below 0 Health', () => {
      expect(isDowned(character())).toBe(false);
      expect(isDowned(character({ resources: { health: { current: 0, max: 20 }, stamina: { current: 10, max: 10 } } }))).toBe(true);
   });
});
