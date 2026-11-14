import { describe, expect, it } from 'vitest';
import { tradeService } from './tradeService.js';
import { characterService } from './characterService.js';
import { inventoryService } from './inventoryService.js';
import { jobStateService } from './jobStateService.js';
import { Character } from '../models/character.js';
import { equipmentOf, identificationOf, inventoryOf, maxDurability, type ItemInstance } from '../../game/character/inventory.js';
import { itemDefinition } from '../../game/data/items.js';
import { NPCS, npcCharacterId } from '../../game/data/npcs.js';
import { SHOPS } from '../../game/data/shops.js';
import { useTestDb } from '../../testing/memoryDb.js';

// The trade writes span two character documents (D60) — only a real database
// proves that goods and coins end up where they should, and nowhere twice.
useTestDb();

const SHOP = SHOPS.plaza_market;
const MERCHANT = npcCharacterId(SHOP.npcId);

async function setup(coins = 0): Promise<string> {
   const { name, epithet, gender, bio, race } = NPCS.plaza_merchant;
   await characterService.createNpc(MERCHANT, { name, epithet, gender, bio, race }, 'plaza');
   await tradeService.openForTheDay(MERCHANT, SHOP, 100);

   const player = await characterService.create('owner-1', { name: 'Buyer', race: 'canid' });
   if (coins > 0)
      await characterService.applyCurrencyDeltas(player._id, { deltradaCoins: coins });
   return player._id;
}

async function pack(characterId: string): Promise<ItemInstance[]> {
   return inventoryOf((await characterService.get(characterId))!);
}

async function coins(characterId: string): Promise<number> {
   return (await characterService.get(characterId))!.currencies.deltradaCoins;
}

async function entry(characterId: string, itemId: string): Promise<ItemInstance> {
   const found = (await pack(characterId)).find((item) => item.itemId === itemId);
   if (!found)
      throw new Error(`${characterId} holds no ${itemId}`);
   return found;
}

describe('tradeService.openForTheDay', () => {
   it('lays out the stock and fills the till, once per day', async () => {
      await setup();

      const stall = await pack(MERCHANT);
      expect(stall.find((item) => item.itemId === 'travel_rations')?.quantity).toBe(6);
      expect(stall.filter((item) => item.itemId === 'iron_sword')).toHaveLength(1);
      expect(await coins(MERCHANT)).toBe(SHOP.dailyCoins);

      // Same day: trading has changed the stall, and it stays changed.
      await characterService.applyCurrencyDeltas(MERCHANT, { deltradaCoins: -200 });
      expect(await tradeService.openForTheDay(MERCHANT, SHOP, 100)).toBe(false);
      expect(await coins(MERCHANT)).toBe(SHOP.dailyCoins - 200);

      // Next day: back to the list, whatever happened yesterday.
      await inventoryService.grantItems(MERCHANT, 'bent_spoon', 'common', 3);
      expect(await tradeService.openForTheDay(MERCHANT, SHOP, 101)).toBe(true);
      expect(await coins(MERCHANT)).toBe(SHOP.dailyCoins);
      expect((await pack(MERCHANT)).some((item) => item.itemId === 'bent_spoon')).toBe(false);
   });

   it('does nothing, and keeps the day unclaimed, when the merchant does not exist', async () => {
      expect(await tradeService.openForTheDay('npc-nobody', SHOP, 100)).toBe(false);
      expect(await jobStateService.claimDay('shop:npc-nobody', 100)).toBe(true);
   });
});

describe('tradeService.buy', () => {
   it('moves the goods and the coins', async () => {
      const player = await setup(100);
      const rations = await entry(MERCHANT, 'travel_rations');

      const result = await tradeService.buy(player, MERCHANT, rations.instanceId, 2);

      expect(result).toEqual({ ok: true, name: 'Travel Rations', quantity: 2, total: 16 });
      expect(await coins(player)).toBe(84);
      expect(await coins(MERCHANT)).toBe(SHOP.dailyCoins + 16);
      expect((await entry(player, 'travel_rations')).quantity).toBe(2);
      expect((await entry(MERCHANT, 'travel_rations')).quantity).toBe(4);
   });

   it('buys only as many as the purse covers', async () => {
      const player = await setup(20);
      const rations = await entry(MERCHANT, 'travel_rations');

      const result = await tradeService.buy(player, MERCHANT, rations.instanceId, Number.MAX_SAFE_INTEGER);

      expect(result).toMatchObject({ ok: true, quantity: 2, total: 16 });
      expect(await coins(player)).toBe(4);
   });

   it('takes the last piece off the stall', async () => {
      const player = await setup(100);
      const sword = await entry(MERCHANT, 'iron_sword');

      expect(await tradeService.buy(player, MERCHANT, sword.instanceId, 1)).toMatchObject({ ok: true, quantity: 1, total: 60 });
      expect((await pack(MERCHANT)).some((item) => item.itemId === 'iron_sword')).toBe(false);
      expect((await entry(player, 'iron_sword')).durability).toBe(maxDurability(itemDefinition('iron_sword')!, 'common'));
   });

   it('refuses an empty purse and a vanished entry, changing nothing', async () => {
      const player = await setup(5);
      const sword = await entry(MERCHANT, 'iron_sword');

      expect(await tradeService.buy(player, MERCHANT, sword.instanceId, 1)).toEqual({ ok: false, reason: 'cannot-afford' });
      expect(await tradeService.buy(player, MERCHANT, 'no-such-entry', 1)).toEqual({ ok: false, reason: 'not-found' });
      expect(await coins(player)).toBe(5);
      expect(await pack(player)).toHaveLength(0);
   });

   it('refuses what the buyer cannot carry, and charges nothing', async () => {
      const player = await setup(100);
      await Character.updateOne({ _id: player }, { $set: { 'attributes.strength': 1 } });
      const sword = await entry(MERCHANT, 'iron_sword');

      expect(await tradeService.buy(player, MERCHANT, sword.instanceId, 1)).toEqual({ ok: false, reason: 'too-heavy' });
      expect(await coins(player)).toBe(100);
      expect((await pack(MERCHANT)).some((item) => item.itemId === 'iron_sword')).toBe(true);
   });
});

describe('tradeService.sell', () => {
   it('pays half the value and puts the goods on the stall', async () => {
      const player = await setup();
      await inventoryService.grantItems(player, 'iron_ingot', 'common', 3);
      const ingots = await entry(player, 'iron_ingot');

      const result = await tradeService.sell(player, MERCHANT, ingots.instanceId, Number.MAX_SAFE_INTEGER);

      expect(result).toEqual({ ok: true, name: 'Iron Ingot', quantity: 3, total: 30 });
      expect(await coins(player)).toBe(30);
      expect(await coins(MERCHANT)).toBe(SHOP.dailyCoins - 30);
      expect(await pack(player)).toHaveLength(0);
      expect((await entry(MERCHANT, 'iron_ingot')).quantity).toBe(3);
   });

   it('sells only as many as the till can pay for, then none', async () => {
      const player = await setup();
      await characterService.applyCurrencyDeltas(MERCHANT, { deltradaCoins: 15 - SHOP.dailyCoins });
      await inventoryService.grantItems(player, 'iron_ingot', 'common', 3);
      const ingots = await entry(player, 'iron_ingot');

      expect(await tradeService.sell(player, MERCHANT, ingots.instanceId, 3)).toMatchObject({ ok: true, quantity: 1, total: 10 });
      expect(await tradeService.sell(player, MERCHANT, ingots.instanceId, 3)).toEqual({ ok: false, reason: 'merchant-broke' });
      expect(await coins(MERCHANT)).toBe(5);
      expect((await entry(player, 'iron_ingot')).quantity).toBe(2);
   });

   it('keeps the wear on sold gear, and prices by it', async () => {
      const player = await setup();
      await inventoryService.grantItems(player, 'war_maul', 'common', 1);
      const maul = await entry(player, 'war_maul');
      const half = Math.round(maxDurability(itemDefinition('war_maul')!, 'common')! / 2);
      await Character.updateOne({ _id: player, 'inventory.instanceId': maul.instanceId }, { $set: { 'inventory.$.durability': half } });

      expect(await tradeService.sell(player, MERCHANT, maul.instanceId, 1)).toMatchObject({ ok: true, total: 37 }); // 150 × ½ wear × ½
      expect((await entry(MERCHANT, 'war_maul')).durability).toBe(half);
   });

   it('refuses equipped gear and unnamed finds without paying', async () => {
      const player = await setup();
      await inventoryService.grantItems(player, 'iron_dagger', 'common', 1);
      const dagger = await entry(player, 'iron_dagger');
      await Character.updateOne({ _id: player }, { $set: { 'equipment.mainHand': dagger.instanceId } });
      await inventoryService.grantItems(player, 'silverleaf', 'common', 1, { descriptorId: 'silvery_leaved' });
      const find = await entry(player, 'silverleaf');

      expect(await tradeService.sell(player, MERCHANT, dagger.instanceId, 1)).toEqual({ ok: false, reason: 'equipped' });
      expect(await tradeService.sell(player, MERCHANT, find.instanceId, 1)).toEqual({ ok: false, reason: 'worthless' });
      expect(await coins(player)).toBe(0);
      expect(equipmentOf((await characterService.get(player))!).mainHand).toBe(dagger.instanceId);
   });

   it('pays a mislabeled find by its label; the stall receives what it truly is', async () => {
      const player = await setup();
      await inventoryService.grantItems(player, 'chokepip', 'common', 2, { descriptorId: 'pale_waxy', apparentItemId: 'silverleaf' });
      const find = await entry(player, 'chokepip');

      expect(await tradeService.sell(player, MERCHANT, find.instanceId, 2)).toMatchObject({ ok: true, name: 'Silverleaf', quantity: 2, total: 12 });

      const onStall = await entry(MERCHANT, 'chokepip');
      expect(identificationOf(onStall)).toBe('identified');
      expect(onStall.quantity).toBe(2);
   });

   it('undoes the payment when the stall has no room', async () => {
      const player = await setup();
      // Fill the stall to the entry cap with single pieces.
      const free = 50 - (await pack(MERCHANT)).length;
      const filler = Array.from({ length: free }, (_, index) => ({
         instanceId: `filler${index}`, itemId: 'quarterstaff', quality: 'common', quantity: 1, durability: 10, acquiredAt: new Date(),
      }));
      await Character.updateOne({ _id: MERCHANT }, { $push: { inventory: { $each: filler } } });
      await inventoryService.grantItems(player, 'iron_dagger', 'common', 1);
      const dagger = await entry(player, 'iron_dagger');

      expect(await tradeService.sell(player, MERCHANT, dagger.instanceId, 1)).toEqual({ ok: false, reason: 'stall-full' });
      expect(await coins(player)).toBe(0);
      expect(await coins(MERCHANT)).toBe(SHOP.dailyCoins);
      expect(await pack(player)).toHaveLength(1);
   });
});
