import { describe, expect, it } from 'vitest';
import { affordableQuantity, buyPrice, sellPrice } from './trade.js';
import { ITEM_IDS, ITEM_QUALITIES, itemDefinition, type ItemId, type ItemQualityId } from '../data/items.js';
import { maxDurability, type ItemInstance, type ResolvedItem } from '../character/inventory.js';

function item(itemId: ItemId, quality: ItemQualityId = 'common', extra: Partial<ItemInstance> = {}): ResolvedItem {
   const definition = itemDefinition(itemId)!;
   return {
      definition,
      instance: { instanceId: 'x', itemId, quality, quantity: 1, acquiredAt: new Date(), ...extra },
   };
}

describe('merchant prices', () => {
   it('asks the full value and pays half of it', () => {
      const poultice = item('healers_poultice'); // value 30
      expect(buyPrice(poultice)).toBe(30);
      expect(sellPrice(poultice)).toBe(15);
   });

   it('scales both ways with quality', () => {
      expect(buyPrice(item('iron_sword', 'fine'))).toBe(150); // 60 × 2.5
      expect(sellPrice(item('iron_sword', 'fine'))).toBe(75);
   });

   it('scales with wear, down to a single coin for a broken piece', () => {
      const max = maxDurability(itemDefinition('iron_sword')!, 'common')!;
      expect(buyPrice(item('iron_sword', 'common', { durability: max / 2 }))).toBe(30);
      expect(sellPrice(item('iron_sword', 'common', { durability: max / 2 }))).toBe(15);
      expect(sellPrice(item('iron_sword', 'common', { durability: 0 }))).toBe(1);
   });

   it('will not pay for an unidentified find', () => {
      expect(sellPrice(item('silverleaf', 'common', { identified: false, descriptorId: 'silvery_leaved' }))).toBe(0);
   });

   it('pays for a mislabeled find by what the seller believes it is', () => {
      // Truly chokepip (1), believed to be silverleaf (12).
      const mislabeled = item('chokepip', 'common', { identified: false, descriptorId: 'pale_waxy', apparentItemId: 'silverleaf' });
      expect(sellPrice(mislabeled)).toBe(6);
   });

   // The property the whole shop rests on: selling and buying back never pays.
   it('never pays more for an item than it asks for it', () => {
      for (const itemId of ITEM_IDS)
         for (const quality of Object.keys(ITEM_QUALITIES) as ItemQualityId[])
            for (const wear of [1, 0.5, 0.1, 0]) {
               const max = maxDurability(itemDefinition(itemId)!, quality);
               const subject = item(itemId, quality, max === null ? {} : { durability: Math.round(max * wear) });
               expect(sellPrice(subject), `${quality} ${itemId} at ${wear}`).toBeLessThanOrEqual(buyPrice(subject));
               expect(buyPrice(subject)).toBeGreaterThanOrEqual(1);
            }
   });
});

describe('affordableQuantity', () => {
   it('caps a request at what the purse covers', () => {
      expect(affordableQuantity(20, 8, 6)).toBe(2);
      expect(affordableQuantity(100, 8, 6)).toBe(6);
      expect(affordableQuantity(7, 8, 6)).toBe(0);
      expect(affordableQuantity(100, 0, 6)).toBe(0);
   });
});
