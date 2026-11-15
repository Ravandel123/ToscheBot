// Pure pricing rules for trading with a merchant — no DB, no Discord.
// Prices are per unit, in deltradaCoins. 🟡 The numbers are placeholders;
// haggling and reputation prices (economy.md) will plug in here later.
import { itemValue, maxDurability, qualityOf, type ResolvedItem } from '../character/inventory.js';

/** A merchant pays this share of an item's value. 🟡 */
export const SELL_RATE = 0.5;

/** How much of its durability an item has left (1 for things that do not wear). */
function condition(item: ResolvedItem): number {
   const max = maxDurability(item.definition, qualityOf(item.instance));
   if (max === null)
      return 1;

   return Math.min(1, Math.max(0, (item.instance.durability ?? max) / max));
}

/** What a merchant asks for one unit off the stall: the item's value, scaled
 *  by quality and by wear. Never below 1. */
export function buyPrice(item: ResolvedItem): number {
   return Math.max(1, Math.round(itemValue(item) * condition(item)));
}

/**
 * What a merchant pays for one unit. 0 = not for sale: an unidentified find
 * is worth nothing to anyone until it is named. The price follows what the
 * SELLER believes the item to be (`itemValue`), so offering a mislabeled find
 * never gives its true nature away — the merchant is taken in by the same
 * lookalike. Never above `buyPrice` for the same item, so there is no profit
 * in selling and buying back.
 */
export function sellPrice(item: ResolvedItem): number {
   const value = itemValue(item);
   if (value <= 0)
      return 0;

   return Math.max(1, Math.floor(value * condition(item) * SELL_RATE));
}

/** How many units a purse can pay for, capped at how many are wanted. */
export function affordableQuantity(coins: number, unitPrice: number, wanted: number): number {
   return unitPrice <= 0 ? 0 : Math.min(wanted, Math.floor(coins / unitPrice));
}
