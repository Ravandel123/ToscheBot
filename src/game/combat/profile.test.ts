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
      attributes: { strength: 25, consitution: 30, agility: 40, dexterity: 25, charisma: 25, willpower: 25, perception: 20, intelligence: 25 },
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
