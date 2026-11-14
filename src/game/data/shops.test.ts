import { describe, expect, it } from 'vitest';
import { SHOPS, shopAt, type ShopDefinition } from './shops.js';
import { NPCS, npcCharacterId } from './npcs.js';
import { actionsAt, hubAction } from './hubActions.js';
import { ITEM_KINDS, itemDefinition } from './items.js';
import { INVENTORY_STACK_LIMIT } from '../character/inventory.js';

// Content-integrity checks for the shop catalog (D60): a shop that points at
// the wrong NPC, a hub action that is not offered where the merchant stands or
// a stock list that cannot fit a pack would only show up mid-trade otherwise.
const shops = Object.entries(SHOPS) as [string, ShopDefinition][];

describe('SHOPS catalog', () => {
   it('is kept by a merchant NPC and opened by an action offered at its home', () => {
      for (const [id, shop] of shops) {
         const npc = NPCS[shop.npcId];
         expect(npc.archetype, `${id} is kept by a non-merchant`).toBe('merchant');
         expect(hubAction(shop.hubActionId), `${id} opens from an unknown hub action`).toBeDefined();
         expect(actionsAt(npc.homeLocationId).map((action) => action.id), `${id} is not offered at ${npc.homeLocationId}`).toContain(shop.hubActionId);
         expect(hubAction(shop.hubActionId)?.comingSoon, `${id} opens from a hidden action`).toBeUndefined();
      }
   });

   it('resolves by location to the merchant character', () => {
      expect(shopAt('plaza')?.merchantId).toBe(npcCharacterId('plaza_merchant'));
      expect(shopAt('riverbank')).toBeNull();
   });

   it('has one shop per location at most', () => {
      const homes = shops.map(([, shop]) => NPCS[shop.npcId].homeLocationId);
      expect(new Set(homes).size).toBe(homes.length);
   });

   it('lays out a stock that fits a pack, with room left to buy from players', () => {
      for (const [id, shop] of shops) {
         const entries = shop.stock.reduce((sum, entry) => {
            const definition = itemDefinition(entry.itemId)!;
            expect(entry.quantity, `${id}/${entry.itemId}`).toBeGreaterThanOrEqual(1);
            return sum + (ITEM_KINDS[definition.kind].stackable ? 1 : entry.quantity);
         }, 0);

         expect(entries, `${id} leaves no room on the stall`).toBeLessThanOrEqual(INVENTORY_STACK_LIMIT / 2);
         expect(shop.dailyCoins).toBeGreaterThan(0);
      }
   });
});
