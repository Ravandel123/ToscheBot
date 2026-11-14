import { NPCS, npcCharacterId, type NpcId } from './npcs.js';
import type { ItemId, ItemQualityId } from './items.js';

// The shop catalog (D60). A shop is NOT a separate thing in the world: it is an
// NPC — a real Character document — whose own pack is the stall and whose own
// coins are the till. This catalog only says how that NPC starts each game day:
// the stock it lays out and the coins it brings. Everything else is the NPC's
// live state, changed by trading.
//
// This daily reset is the merchant's whole "mind" for now. When NPCs get their
// own behaviour (PLAN "Later"), the reset is what that behaviour replaces — the
// trade code (tradeService) already works on plain character docs and will not
// care where the stock came from.
//
// 🟡 Every number here is a balance placeholder.

export interface ShopStockEntry {
   itemId: ItemId;
   quantity: number;
   /** Default: common. */
   quality?: ItemQualityId;
}

export interface ShopDefinition {
   /** The merchant (→ NPCS). The shop stands where this NPC's home is. */
   npcId: NpcId;
   /** The hub action that opens it (→ HUB_ACTIONS) — its availability (daylight
    *  hours…) is re-checked on every trade click. */
   hubActionId: string;
   /** The merchant's line on the stall panel. */
   greeting: string;
   /** Coins in the till at the start of each game day: the most the merchant
    *  can pay out to sellers that day, plus whatever buyers bring in. */
   dailyCoins: number;
   /** What is on the stall at the start of each game day. */
   stock: readonly ShopStockEntry[];
}

export const SHOPS = {
   plaza_market: {
      npcId: 'plaza_merchant',
      hubActionId: 'market',
      greeting: '"Everything has a price, friend — and I remember every one of them."',
      dailyCoins: 250,
      stock: [
         { itemId: 'travel_rations', quantity: 6 },
         { itemId: 'dried_carp', quantity: 4 },
         { itemId: 'healers_poultice', quantity: 4 },
         { itemId: 'honeyed_mead', quantity: 3 },
         { itemId: 'quarterstaff', quantity: 1 },
         { itemId: 'iron_dagger', quantity: 1 },
         { itemId: 'ash_spear', quantity: 1 },
         { itemId: 'woodsmans_axe', quantity: 1 },
         { itemId: 'iron_sword', quantity: 1 },
         { itemId: 'wooden_buckler', quantity: 1 },
         { itemId: 'leather_cap', quantity: 1 },
         { itemId: 'leather_gloves', quantity: 1 },
         { itemId: 'sturdy_boots', quantity: 1 },
         { itemId: 'leather_jerkin', quantity: 1 },
      ],
   },
} as const satisfies Record<string, ShopDefinition>;

export type ShopId = keyof typeof SHOPS;

export interface LocatedShop {
   id: ShopId;
   shop: ShopDefinition;
   /** The merchant's Character._id. */
   merchantId: string;
}

/** The shop standing at a location, if any (one per location for now). */
export function shopAt(locationId: string): LocatedShop | null {
   for (const [id, shop] of Object.entries(SHOPS) as [ShopId, ShopDefinition][])
      if (NPCS[shop.npcId].homeLocationId === locationId)
         return { id, shop, merchantId: npcCharacterId(shop.npcId) };

   return null;
}
