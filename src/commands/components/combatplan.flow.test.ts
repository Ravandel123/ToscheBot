import { describe, expect, it } from 'vitest';
import combatPlanHandler from './combatplan.js';
import { accountService } from '../../db/services/accountService.js';
import { characterService } from '../../db/services/characterService.js';
import { fakeButton, fakeClient, fakeSelect } from '../../testing/fakeInteraction.js';
import { useTestDb } from '../../testing/memoryDb.js';
import type { FamilyPlan } from '../../game/combat/plan.js';
import type { StyleFamily } from '../../game/combat/styles.js';

// Layer-2 flow test (the profile.flow pattern): drive the `combatplan` handler
// with fake selects/buttons and assert the whole loop — active-character
// resolution, plan validation, the setCombatPlan write to the in-memory DB,
// and the panel repaint.
useTestDb();

const USER = { userId: 'u1', displayName: 'Ravandel' };

/** Onboards the account and puts one active character under it. */
async function withActiveCharacter(): Promise<string> {
   await accountService.getOrCreate(USER.userId, USER.displayName);
   const character = await characterService.create(USER.userId, { name: 'Bruna' });
   await accountService.setActiveCharacter(USER.userId, USER.displayName, character._id, fakeClient().locks);
   return character._id;
}

async function storedPlan(characterId: string, family: StyleFamily): Promise<FamilyPlan | undefined> {
   const fresh = await characterService.get(characterId);
   return fresh?.combatPlan?.[family];
}

describe('combatplan handler — default style', () => {
   it('sets a family default style and repaints the panel', async () => {
      const characterId = await withActiveCharacter();
      const { interaction, captured } = fakeSelect('combatplan:style:unarmed', ['striker'], USER);

      await combatPlanHandler.handle(fakeClient(), interaction);

      expect((await storedPlan(characterId, 'unarmed'))?.style).toBe('striker');
      expect(captured.updates).toHaveLength(1);
      expect(captured.replies).toHaveLength(0);
   });

   it("'none' clears the default back to fighting plain", async () => {
      const characterId = await withActiveCharacter();

      await combatPlanHandler.handle(fakeClient(), fakeSelect('combatplan:style:unarmed', ['striker'], USER).interaction);
      await combatPlanHandler.handle(fakeClient(), fakeSelect('combatplan:style:unarmed', ['none'], USER).interaction);

      expect((await storedPlan(characterId, 'unarmed'))?.style).toBeNull();
   });

   it('refuses a wrong-family style (an armed style on the unarmed select)', async () => {
      const characterId = await withActiveCharacter();

      await combatPlanHandler.handle(fakeClient(), fakeSelect('combatplan:style:unarmed', ['warden'], USER).interaction);

      expect((await storedPlan(characterId, 'unarmed'))?.style).toBeNull();
   });

   it('families are independent: a one-handed default leaves unarmed untouched', async () => {
      const characterId = await withActiveCharacter();

      await combatPlanHandler.handle(fakeClient(), fakeSelect('combatplan:style:unarmed', ['grappler'], USER).interaction);
      await combatPlanHandler.handle(fakeClient(), fakeSelect('combatplan:style:one_handed', ['warden'], USER).interaction);
      await combatPlanHandler.handle(fakeClient(), fakeSelect('combatplan:style:two_handed', ['iron_gate'], USER).interaction);

      expect((await storedPlan(characterId, 'unarmed'))?.style).toBe('grappler');
      expect((await storedPlan(characterId, 'one_handed'))?.style).toBe('warden');
      expect((await storedPlan(characterId, 'two_handed'))?.style).toBe('iron_gate');
   });
});

describe('combatplan handler — switch rules', () => {
   it('walks the two-step rule builder and appends the rule', async () => {
      const characterId = await withActiveCharacter();

      // ➕ Rule → trigger picker
      const open = fakeButton('combatplan:newrule:unarmed', USER);
      await combatPlanHandler.handle(fakeClient(), open.interaction);
      expect(open.captured.updates).toHaveLength(1);

      // trigger select → style picker (the half-built rule rides the customId)
      const trigger = fakeSelect('combatplan:ruletrigger:unarmed', ['self-health-below.50'], USER);
      await combatPlanHandler.handle(fakeClient(), trigger.interaction);
      expect(trigger.captured.updates).toHaveLength(1);

      // style select → rule saved, panel repainted
      const style = fakeSelect('combatplan:rulestyle:unarmed:self-health-below.50', ['stonewall'], USER);
      await combatPlanHandler.handle(fakeClient(), style.interaction);

      expect((await storedPlan(characterId, 'unarmed'))?.rules).toEqual([
         { trigger: { kind: 'self-health-below', value: 50 }, style: 'stonewall' },
      ]);
   });

   it('refuses a garbled rule token instead of writing junk', async () => {
      const characterId = await withActiveCharacter();
      const { interaction, captured } = fakeSelect('combatplan:rulestyle:unarmed:nonsense', ['stonewall'], USER);

      await combatPlanHandler.handle(fakeClient(), interaction);

      expect(await storedPlan(characterId, 'unarmed')).toBeUndefined();
      expect(captured.replies).toHaveLength(1); // "start it again from the panel"
      expect(captured.updates).toHaveLength(0);
   });

   it('caps the rule list: a fourth ➕ is refused ephemerally', async () => {
      const characterId = await withActiveCharacter();
      await characterService.setCombatPlan(characterId, 'unarmed', {
         style: null,
         rules: [
            { trigger: { kind: 'self-health-below', value: 75 }, style: 'grappler' },
            { trigger: { kind: 'self-health-below', value: 50 }, style: 'stonewall' },
            { trigger: { kind: 'self-health-below', value: 25 }, style: 'striker' },
         ],
      });

      const { interaction, captured } = fakeButton('combatplan:newrule:unarmed', USER);
      await combatPlanHandler.handle(fakeClient(), interaction);

      expect(captured.replies).toHaveLength(1); // "at most N rules"
      expect(captured.updates).toHaveLength(0);
      expect((await storedPlan(characterId, 'unarmed'))?.rules).toHaveLength(3);
   });

   it('clears a family\'s rules but keeps its default style', async () => {
      const characterId = await withActiveCharacter();
      await characterService.setCombatPlan(characterId, 'unarmed', {
         style: 'striker',
         rules: [{ trigger: { kind: 'round-at-least', value: 3 }, style: 'stonewall' }],
      });

      await combatPlanHandler.handle(fakeClient(), fakeButton('combatplan:clearrules:unarmed', USER).interaction);

      expect(await storedPlan(characterId, 'unarmed')).toEqual({ style: 'striker', rules: [] });
   });
});

describe('combatplan handler — guards', () => {
   it('tells a user with no active character to create one', async () => {
      const { interaction, captured } = fakeSelect('combatplan:style:unarmed', ['striker'], USER);

      await combatPlanHandler.handle(fakeClient(), interaction);

      expect(captured.updates).toHaveLength(1); // the panel degrades to the notice
      expect(String((captured.updates[0] as { content: string }).content)).toContain('no active character');
   });

   it('refuses an unknown family without writing', async () => {
      await withActiveCharacter();
      const { interaction, captured } = fakeSelect('combatplan:style:ranged', ['striker'], USER);

      await combatPlanHandler.handle(fakeClient(), interaction);

      expect(captured.replies).toHaveLength(1);
      expect(captured.updates).toHaveLength(0);
   });
});
