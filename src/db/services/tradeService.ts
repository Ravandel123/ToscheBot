import { characterService } from './characterService.js';
import { inventoryService } from './inventoryService.js';
import { jobStateService } from './jobStateService.js';
import { findItem, itemDisplayName, slotOfInstance } from '../../game/character/inventory.js';
import { ITEM_KINDS } from '../../game/data/items.js';
import { affordableQuantity, buyPrice, sellPrice } from '../../game/economy/trade.js';
import type { ShopDefinition } from '../../game/data/shops.js';

// Trading with a merchant NPC. A merchant is an ordinary Character: its
// pack is the stall, its coins are the till. CONTRACT for every function here:
// the caller holds BOTH characters' locks (`client.locks.runExclusive`), which
// is what makes the read-decide-write below safe against a second trader.
//
// The writes of one trade are separate (no transactions, by design). Their
// order is chosen so that a crash in between can only favour the PLAYER:
//   buying  — goods first, then the charge  (worst case: an unpaid item);
//   selling — payment first, then the goods (worst case: paid and still holding it).

export type TradeFailure =
   | 'not-found'
   | 'equipped'
   | 'worthless'
   | 'cannot-afford'
   | 'merchant-broke'
   | 'inventory-full'
   | 'too-heavy'
   | 'stall-full';

export type TradeResult =
   | { ok: true; name: string; quantity: number; total: number }
   | { ok: false; reason: TradeFailure };

export const tradeService = {
   /**
    * Lays the stall out for a new game day: the catalog stock, and the till
    * back to the shop's daily coins. Runs at most once per day per merchant
    * (the first trader of the day triggers it); returns whether it ran.
    * Whatever the merchant bought yesterday is gone with the caravans, and so
    * is yesterday's takings — the reset is both the shop's coin source (the
    * till) and its coin sink (what buyers paid).
    */
   async openForTheDay(merchantId: string, shop: ShopDefinition, day: number): Promise<boolean> {
      const merchant = await characterService.get(merchantId);
      if (!merchant || !await jobStateService.claimDay(`shop:${merchantId}`, day))
         return false;

      await inventoryService.setStock(merchantId, shop.stock);
      await characterService.applyCurrencyDeltas(merchantId, { deltradaCoins: shop.dailyCoins - merchant.currencies.deltradaCoins });
      return true;
   },

   /** The player buys up to `quantity` units of one stall entry — as many as
    *  they can pay for. */
   async buy(buyerId: string, merchantId: string, instanceId: string, quantity: number): Promise<TradeResult> {
      const [buyer, merchant] = await Promise.all([characterService.get(buyerId), characterService.get(merchantId)]);
      const item = merchant ? findItem(merchant, instanceId) : null;
      if (!buyer || !item)
         return { ok: false, reason: 'not-found' };

      const unit = buyPrice(item);
      const amount = affordableQuantity(buyer.currencies.deltradaCoins, unit, wantedUnits(item.instance.quantity, quantity, item.definition.kind));
      if (amount < 1)
         return { ok: false, reason: 'cannot-afford' };

      const moved = await inventoryService.transferItem(merchantId, buyerId, instanceId, amount);
      if (!moved.ok)
         return moved;

      const total = unit * moved.moved;
      await characterService.applyCurrencyDeltas(buyerId, { deltradaCoins: -total });
      await characterService.applyCurrencyDeltas(merchantId, { deltradaCoins: total });
      return { ok: true, name: itemDisplayName(item), quantity: moved.moved, total };
   },

   /** The player sells up to `quantity` units of one pack entry — as many as
    *  the merchant's till can pay for. */
   async sell(sellerId: string, merchantId: string, instanceId: string, quantity: number): Promise<TradeResult> {
      const [seller, merchant] = await Promise.all([characterService.get(sellerId), characterService.get(merchantId)]);
      const item = seller ? findItem(seller, instanceId) : null;
      if (!seller || !merchant || !item)
         return { ok: false, reason: 'not-found' };
      if (slotOfInstance(seller, instanceId))
         return { ok: false, reason: 'equipped' };

      const unit = sellPrice(item);
      if (unit <= 0)
         return { ok: false, reason: 'worthless' };

      const amount = affordableQuantity(merchant.currencies.deltradaCoins, unit, wantedUnits(item.instance.quantity, quantity, item.definition.kind));
      if (amount < 1)
         return { ok: false, reason: 'merchant-broke' };

      // Paid first; if the goods then cannot change hands, the payment is undone.
      const total = unit * amount;
      const name = itemDisplayName(item);
      await characterService.applyCurrencyDeltas(sellerId, { deltradaCoins: total });

      const moved = await inventoryService.transferItem(sellerId, merchantId, instanceId, amount, { ignoreWeight: true });
      if (!moved.ok) {
         await characterService.applyCurrencyDeltas(sellerId, { deltradaCoins: -total });
         return { ok: false, reason: moved.reason === 'inventory-full' ? 'stall-full' : moved.reason };
      }

      await characterService.applyCurrencyDeltas(merchantId, { deltradaCoins: -total });
      return { ok: true, name, quantity: moved.moved, total };
   },
};

/** How many units a request means: gear trades one piece at a time, a stack
 *  up to what it holds. */
function wantedUnits(held: number, requested: number, kind: keyof typeof ITEM_KINDS): number {
   return ITEM_KINDS[kind].stackable ? Math.min(held, Math.max(1, Math.floor(requested))) : 1;
}
