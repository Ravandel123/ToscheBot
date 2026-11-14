import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import marketHandler from './market.js';
import playHandler from './play.js';
import { accountService } from '../../db/services/accountService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { inventoryService } from '../../db/services/inventoryService.js';
import { Character } from '../../db/models/character.js';
import { initialChallengeState } from '../../game/activity/challenge.js';
import { inventoryOf } from '../../game/character/inventory.js';
import { NPCS, npcCharacterId } from '../../game/data/npcs.js';
import { SHOPS } from '../../game/data/shops.js';
import { fakeButton, fakeClient, fakeSelect } from '../../testing/fakeInteraction.js';
import { useTestDb } from '../../testing/memoryDb.js';

// Layer-2 flow tests for the stall (D60): hub click → stall → item card →
// trade → repaint, against the in-memory DB. Only the Date is faked — the
// stall keeps daylight hours on the game clock (UTC+2).
useTestDb();

const MIDDAY = new Date('2026-11-14T10:00:00Z'); // 12:00 on the game clock
const MIDNIGHT = new Date('2026-11-14T22:30:00Z'); // 00:30 on the game clock

beforeEach(() => {
   vi.useFakeTimers({ toFake: ['Date'] });
   vi.setSystemTime(MIDDAY);
});

afterEach(() => vi.useRealTimers());

const USER = { userId: 'u1', displayName: 'Rav' };
const MERCHANT = npcCharacterId(SHOPS.plaza_market.npcId);

async function shopper(coins = 100, approved = true): Promise<string> {
   const client = fakeClient();
   await accountService.getOrCreate(USER.userId, USER.displayName);
   const character = await characterService.create(USER.userId, { name: 'Shopper', race: 'canid' });
   if (approved) {
      await characterService.submitForApproval(character._id);
      await characterService.approve(character._id);
   }
   await characterService.setLocation(character._id, 'plaza');
   await characterService.applyCurrencyDeltas(character._id, { deltradaCoins: coins });
   await accountService.setActiveCharacter(USER.userId, USER.displayName, character._id, client.locks);
   return character._id;
}

async function seedMerchant(location = 'plaza'): Promise<void> {
   const { name, epithet, gender, bio, race } = NPCS.plaza_merchant;
   await characterService.createNpc(MERCHANT, { name, epithet, gender, bio, race }, location);
}

async function stallEntry(itemId: string): Promise<string> {
   const merchant = (await characterService.get(MERCHANT))!;
   return inventoryOf(merchant).find((item) => item.itemId === itemId)!.instanceId;
}

async function openStall(): Promise<string> {
   const { interaction, captured } = fakeButton('play:act:market', USER);
   await playHandler.handle(fakeClient(), interaction);
   return JSON.stringify(captured.updates.at(-1));
}

describe('opening the stall', () => {
   it('lays out the day and shows the Buy tab on the hub message', async () => {
      await shopper();
      await seedMerchant();

      const view = await openStall();

      expect(view).toContain('market:pick:buy:0');
      expect(view).toContain('Travel Rations');
      expect(view).toContain('play:hub'); // the way back
      expect((await characterService.get(MERCHANT))!.currencies.deltradaCoins).toBe(SHOPS.plaza_market.dailyCoins);
   });

   it('falls back to the hub when the merchant is not there', async () => {
      await shopper();
      await seedMerchant('tavern');

      expect(await openStall()).toContain('nowhere to be seen');
   });

   it('is shut at night, even from a panel left open since the day', async () => {
      await shopper();
      await seedMerchant();
      await openStall();
      const rations = await stallEntry('travel_rations');

      vi.setSystemTime(MIDNIGHT);
      const tab = fakeButton('market:tab:sell:0', USER);
      await marketHandler.handle(fakeClient(), tab.interaction);
      expect(JSON.stringify(tab.captured.updates.at(-1))).toContain('shut');

      const trade = fakeButton(`market:do:buy:0:${rations}:1`, USER);
      await marketHandler.handle(fakeClient(), trade.interaction);
      expect(JSON.stringify(trade.captured.updates.at(-1))).toContain('shut');
      expect((await characterService.get(await activeId()))!.currencies.deltradaCoins).toBe(100);
   });

   it('turns away a character the Imperator has not recognized', async () => {
      await shopper(100, false);
      await seedMerchant();

      expect(await openStall()).toContain('recognized');
   });
});

async function activeId(): Promise<string> {
   return (await accountService.getActiveCharacter(USER.userId, USER.displayName))!._id;
}

describe('trading', () => {
   it('shows an item card with trade buttons, then buys', async () => {
      const characterId = await shopper(100);
      await seedMerchant();
      await openStall();
      const rations = await stallEntry('travel_rations');

      const pick = fakeSelect('market:pick:buy:0', [rations], USER);
      await marketHandler.handle(fakeClient(), pick.interaction);
      const card = JSON.stringify(pick.captured.updates.at(-1));
      expect(card).toContain(`market:do:buy:0:${rations}:1`);
      expect(card).toContain(`market:do:buy:0:${rations}:all`);

      const trade = fakeButton(`market:do:buy:0:${rations}:5`, USER);
      await marketHandler.handle(fakeClient(), trade.interaction);

      expect(trade.captured.deferredUpdate).toBe(true);
      expect(JSON.stringify(trade.captured.updates.at(-1))).toContain('You buy');
      const after = (await characterService.get(characterId))!;
      expect(after.currencies.deltradaCoins).toBe(60);
      expect(inventoryOf(after).find((item) => item.itemId === 'travel_rations')?.quantity).toBe(5);
   });

   it('never puts two buttons with the same id on one message', async () => {
      await shopper(100);
      await seedMerchant();
      await openStall();
      // Enough extra entries to need a second page (pushed raw: a stall is not
      // bound by its keeper's carry weight, a plain grant is).
      const extras = ['bent_spoon', 'cracked_tankard', 'smooth_river_stone', 'mysterious_sock']
         .map((itemId, index) => ({ instanceId: `extra${index}`, itemId, quality: 'common', quantity: 1, acquiredAt: new Date() }));
      await Character.updateOne({ _id: MERCHANT }, { $push: { inventory: { $each: extras } } });

      for (const page of [0, 1]) {
         const { interaction, captured } = fakeButton(`market:page:buy:${page}`, USER);
         await marketHandler.handle(fakeClient(), interaction);

         const view = JSON.stringify(captured.updates.at(-1));
         const ids = [...view.matchAll(/"custom_id":"([^"]+)"/g)].map((match) => match[1]);
         expect(view).toContain(`page ${page + 1}/2`);
         expect(new Set(ids).size, `page ${page}: ${ids.join(', ')}`).toBe(ids.length);
      }
   });

   it('sells from the pack and repaints the Sell tab', async () => {
      const characterId = await shopper(0);
      await seedMerchant();
      await openStall();
      await inventoryService.grantItems(characterId, 'iron_ingot', 'common', 2);
      const ingots = inventoryOf((await characterService.get(characterId))!)[0].instanceId;

      const tab = fakeButton('market:tab:sell:0', USER);
      await marketHandler.handle(fakeClient(), tab.interaction);
      expect(JSON.stringify(tab.captured.updates.at(-1))).toContain('market:pick:sell:0');

      const trade = fakeButton(`market:do:sell:0:${ingots}:all`, USER);
      await marketHandler.handle(fakeClient(), trade.interaction);

      expect(JSON.stringify(trade.captured.updates.at(-1))).toContain('You sell');
      expect((await characterService.get(characterId))!.currencies.deltradaCoins).toBe(20);
      expect((await characterService.get(MERCHANT))!.currencies.deltradaCoins).toBe(SHOPS.plaza_market.dailyCoins - 20);
   });

   it('reports a stale entry instead of trading something else', async () => {
      const characterId = await shopper(100);
      await seedMerchant();
      await openStall();

      const trade = fakeButton('market:do:buy:0:gone1234:1', USER);
      await marketHandler.handle(fakeClient(), trade.interaction);

      expect(JSON.stringify(trade.captured.updates.at(-1))).toContain('no longer there');
      expect((await characterService.get(characterId))!.currencies.deltradaCoins).toBe(100);
   });

   it('sends a character with unfinished business back to it', async () => {
      const characterId = await shopper(100);
      await seedMerchant();
      await openStall();
      const rations = await stallEntry('travel_rations');
      await activitySessionService.create('challenge', [characterId], { ...initialChallengeState('fallen_tree', 'plaza', 'riverbank', {}) });

      const trade = fakeButton(`market:do:buy:0:${rations}:1`, USER);
      await marketHandler.handle(fakeClient(), trade.interaction);

      expect(JSON.stringify(trade.captured.updates.at(-1))).toContain('Unfinished business');
      expect((await characterService.get(characterId))!.currencies.deltradaCoins).toBe(100);
   });
});
