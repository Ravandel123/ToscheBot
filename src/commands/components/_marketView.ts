// Discord builders for a merchant's stall — read-only views over two
// packs: the merchant's (the Buy tab) and the player's (the Sell tab).
// Stateless like every panel: mode and page ride in the customIds, the stall
// itself is re-resolved from where the character stands at click time.
//   market:tab:<mode>:<page>                    → the list (tab switch / back from a card)
//   market:page:<mode>:<page>                   → the same list, another page — its own
//                                                 action so no two buttons share an id
//   market:pick:<mode>:<page>   (select)        → one item's trade card
//   market:do:<mode>:<page>:<instanceId>:<qty>  → the trade (qty = a number or 'all')
import { ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { displayName } from '../../game/character/identity.js';
import {
   findItem,
   identificationOf,
   itemDisplayName,
   perceivedDefinition,
   resolveInventory,
   slotOfInstance,
   type ResolvedItem,
} from '../../game/character/inventory.js';
import { ITEM_KINDS, ITEM_KIND_IDS } from '../../game/data/items.js';
import { buyPrice, sellPrice } from '../../game/economy/trade.js';
import { quantitySuffix, truncate } from '../../lib/text.js';
import { actionRow, type ComponentRow, type PanelView } from '../../lib/discord.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ShopDefinition } from '../../game/data/shops.js';

const MARKET_COLOR = 0xB8860B; // old coin

/** Entries per page — a stall's daily stock fits on the first one. */
export const MARKET_PAGE_SIZE = 15;

export type MarketMode = 'buy' | 'sell';

/** One line of a stall list: the item, its unit price, and — when it cannot be
 *  traded — why (price 0). */
export interface MarketRow {
   item: ResolvedItem;
   price: number;
   blocked?: string;
}

/** Whose pack a mode trades out of. */
function sourceOf(mode: MarketMode, character: CharacterDoc, merchant: CharacterDoc): CharacterDoc {
   return mode === 'buy' ? merchant : character;
}

/** Everything a mode lists, tradable entries first, then by kind and name. */
export function marketRows(mode: MarketMode, character: CharacterDoc, merchant: CharacterDoc): MarketRow[] {
   const source = sourceOf(mode, character, merchant);

   const rows = resolveInventory(source).map((item): MarketRow => {
      if (mode === 'buy')
         return { item, price: buyPrice(item) };
      if (slotOfInstance(source, item.instance.instanceId))
         return { item, price: 0, blocked: 'you are wearing it' };
      if (identificationOf(item.instance) === 'unidentified')
         return { item, price: 0, blocked: 'nobody pays for what cannot be named' };
      return { item, price: sellPrice(item) };
   });

   const kindOrder = (row: MarketRow): number => ITEM_KIND_IDS.indexOf(perceivedDefinition(row.item).kind);
   return rows.sort((a, b) =>
      Number(a.price === 0) - Number(b.price === 0)
      || kindOrder(a) - kindOrder(b)
      || itemDisplayName(a.item).localeCompare(itemDisplayName(b.item)));
}

/** The item a trade card / trade click refers to, from the pack its mode trades out of. */
export function marketItem(mode: MarketMode, character: CharacterDoc, merchant: CharacterDoc, instanceId: string): ResolvedItem | null {
   return findItem(sourceOf(mode, character, merchant), instanceId);
}

/** The stall: one tab's list, a select to pick an item, tab and page buttons. */
export function buildMarketList(shop: ShopDefinition, character: CharacterDoc, merchant: CharacterDoc, mode: MarketMode, page = 0, note = ''): PanelView {
   const rows = marketRows(mode, character, merchant);
   const pageCount = Math.max(1, Math.ceil(rows.length / MARKET_PAGE_SIZE));
   const current = Math.min(Math.max(0, page), pageCount - 1);
   const shown = rows.slice(current * MARKET_PAGE_SIZE, (current + 1) * MARKET_PAGE_SIZE);

   const lines = shown.map((row) => {
      const name = `${kindEmoji(row.item)} **${itemDisplayName(row.item)}**${quantitySuffix(row.item.instance.quantity)}`;
      return row.price > 0 ? `${name} — **${row.price}** 🪙` : `🔒 ${name} — ${row.blocked ?? 'not for sale'}`;
   });

   const embed = new EmbedBuilder()
      .setColor(MARKET_COLOR)
      .setTitle(`🪙 ${displayName(merchant)}`)
      .setDescription([
         note ? `${note}\n` : '',
         shop.greeting,
         purseLine(character, merchant),
         // In the description, not a field: a field holds 1024 characters,
         // too few for a full page of long item names.
         `\n**${mode === 'buy' ? 'On the stall' : 'From your pack'}**`,
         lines.join('\n') || (mode === 'buy' ? 'The stall is bare.' : 'You carry nothing to sell.'),
      ].filter(Boolean).join('\n'))
      .setFooter({ text: `${mode === 'buy' ? 'Prices are per piece' : 'Offers are per piece'} · page ${current + 1}/${pageCount}` });

   const components: ComponentRow[] = [];

   const tradable = shown.filter((row) => row.price > 0);
   if (tradable.length > 0)
      components.push(actionRow(
         new StringSelectMenuBuilder()
            .setCustomId(`market:pick:${mode}:${current}`)
            .setPlaceholder(mode === 'buy' ? 'Buy…' : 'Sell…')
            .addOptions(tradable.map((row) => ({
               label: truncate(`${itemDisplayName(row.item)}${quantitySuffix(row.item.instance.quantity)}`, 100),
               description: `${row.price} coins each`,
               value: row.item.instance.instanceId,
               emoji: kindEmoji(row.item),
            }))),
      ));

   const button = (id: string, label: string, emoji: string, disabled = false, style = ButtonStyle.Secondary): ButtonBuilder =>
      new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style).setDisabled(disabled);

   components.push(actionRow(
      button('market:tab:buy:0', 'Buy', '🛒', mode === 'buy', ButtonStyle.Primary),
      button('market:tab:sell:0', 'Sell', '💰', mode === 'sell', ButtonStyle.Primary),
      button(`market:page:${mode}:${current - 1}`, 'Prev', '◀️', current === 0),
      button(`market:page:${mode}:${current + 1}`, 'Next', '▶️', current >= pageCount - 1),
      button('play:hub', 'Leave the stall', '↩️'),
   ));

   return { content: '', embeds: [embed], components };
}

/** One item's card with its trade buttons. */
export function buildTradeCard(character: CharacterDoc, merchant: CharacterDoc, mode: MarketMode, page: number, item: ResolvedItem): PanelView {
   const unit = mode === 'buy' ? buyPrice(item) : sellPrice(item);
   const held = item.instance.quantity;
   const payer = mode === 'buy' ? character : merchant;
   const canPayOne = unit > 0 && payer.currencies.deltradaCoins >= unit;
   const verb = mode === 'buy' ? 'Buy' : 'Sell';

   // The seller's belief, not the truth: a mislabeled find reads as its label.
   const definition = perceivedDefinition(item);

   const embed = new EmbedBuilder()
      .setColor(MARKET_COLOR)
      .setTitle(`${kindEmoji(item)} ${itemDisplayName(item)}${quantitySuffix(item.instance.quantity)}`)
      .setDescription([
         `_${definition.description}_`,
         '',
         mode === 'buy' ? `Price: **${unit}** 🪙 each` : `${displayName(merchant)} offers: **${unit}** 🪙 each`,
         purseLine(character, merchant),
         canPayOne ? '' : (mode === 'buy' ? '🔒 Your purse is too light for this.' : '🔒 The till cannot cover this today.'),
      ].filter(Boolean).join('\n'));

   const trade = (quantity: number | 'all', label: string): ButtonBuilder =>
      new ButtonBuilder()
         .setCustomId(`market:do:${mode}:${page}:${item.instance.instanceId}:${quantity}`)
         .setLabel(label)
         .setStyle(ButtonStyle.Success)
         .setDisabled(!canPayOne);

   const buttons = ITEM_KINDS[item.definition.kind].stackable && held > 1
      ? [
         trade(1, `${verb} 1`),
         ...(held > 5 ? [trade(5, `${verb} 5`)] : []),
         trade('all', `${verb} all (${held})`),
      ]
      : [trade(1, verb)];

   buttons.push(new ButtonBuilder().setCustomId(`market:tab:${mode}:${page}`).setLabel('Back').setEmoji('↩️').setStyle(ButtonStyle.Secondary));

   return {
      content: '',
      embeds: [embed],
      components: [actionRow(buttons)],
   };
}

function purseLine(character: CharacterDoc, merchant: CharacterDoc): string {
   return `🪙 Your purse: **${character.currencies.deltradaCoins}** · the till: **${merchant.currencies.deltradaCoins}**`;
}

function kindEmoji(item: ResolvedItem): string {
   return ITEM_KINDS[perceivedDefinition(item).kind].emoji;
}
