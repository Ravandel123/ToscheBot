// Discord adapter (marked): the stash panel (D33) — hub (container + category
// tabs) → category list (server-side sorted/paged) → item card (Withdraw). It
// deliberately REUSES the `/inventory` item renderers (`detailEmbed`,
// `lineSummary`) so a stashed item shows an identical card; only the data source
// differs (the separate `Item` collection, paged in Mongo, never fully loaded).
// Stateless like every panel: the character id, container, browse state
// (container.kind.sort.page) and inspected handle ride in the customIds, and
// every view renders from a fresh service read. Underscore prefix → loader skips it.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import { ITEM_KINDS, ITEM_KIND_IDS, DEFAULT_ITEM_QUALITY, isItemQualityId, type ItemKindId } from '../../game/data/items.js';
import { STORAGE_CONTAINERS, type StorageContainerId } from '../../game/data/containers.js';
import {
   STASH_SORTS,
   packStashState,
   resolveStashInstance,
   type StashBrowseState,
   type StashSortId,
} from '../../game/character/stash.js';
import { itemDisplayName, type ItemInstance, type ResolvedItem } from '../../game/character/inventory.js';
import { displayName } from '../../game/character/identity.js';
import { detailEmbed, lineSummary, type InventoryView } from './_inventoryPanel.js';
import type { ItemDoc } from '../../db/models/item.js';
import type { CharacterDoc } from '../../db/models/character.js';

const PANEL_COLOR = 0x6B4F2A; // darker chest oak, a shade off the pack leather

type Row = ActionRowBuilder<MessageActionRowComponentBuilder>;

/** A resolved, ready-to-render page of one stash category (built by the handler
 *  from the service's paged docs — the panel never queries). */
export interface StashResolvedPage {
   items: ResolvedItem[];
   page: number;
   pageCount: number;
   totalCount: number;
}

/** Maps stored stash docs to display items, dropping unknown ids (D10 rule 3). */
export function resolveStashDocs(docs: ItemDoc[]): ResolvedItem[] {
   return docs.flatMap((doc) => {
      const resolved = resolveStashInstance(stashInstance(doc));
      return resolved ? [resolved] : [];
   });
}

function stashInstance(doc: ItemDoc): ItemInstance {
   return {
      instanceId: doc.instanceId,
      itemId: doc.itemId,
      quality: isItemQualityId(doc.quality) ? doc.quality : DEFAULT_ITEM_QUALITY,
      quantity: doc.quantity,
      ...(doc.durability === undefined ? {} : { durability: doc.durability }),
      acquiredAt: doc.acquiredAt,
   };
}

// --- Hub -----------------------------------------------------------------------

/** The landing view: the container, what it holds by category, and the tabs. */
export function buildStashHub(character: CharacterDoc, container: StorageContainerId, counts: Record<ItemKindId, number>, note?: string): InventoryView {
   const def = STORAGE_CONTAINERS[container];
   const total = ITEM_KIND_IDS.reduce((sum, kind) => sum + counts[kind], 0);
   const filled = ITEM_KIND_IDS.filter((kind) => counts[kind] > 0);

   const countLine = filled.map((kind) => `${ITEM_KINDS[kind].emoji} ${ITEM_KINDS[kind].name} ${counts[kind]}`).join('\n');

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`${def.emoji} ${displayName(character)} — ${def.name}`)
      .setDescription([note, `*${def.description}*`].filter(Boolean).join('\n\n'))
      .addFields({
         name: 'Stored',
         value: total > 0 ? countLine : '*Empty. Store items from your pack with the 🗄️ button in `/inventory`.*',
      })
      .setFooter({ text: `${total} ${total === 1 ? 'entry' : 'entries'} · pick a category to withdraw` });

   const components = total > 0 ? [categoryRow(character, container, counts, filled)] : [];
   return { embeds: [embed], components };
}

function categoryRow(character: CharacterDoc, container: StorageContainerId, counts: Record<ItemKindId, number>, filled: ItemKindId[]): Row {
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`stash:cat:${character._id}:${container}`)
      .setPlaceholder('Withdraw from a category…')
      .addOptions(filled.map((kind) => ({
         label: `${ITEM_KINDS[kind].name} (${counts[kind]})`,
         value: kind,
         emoji: ITEM_KINDS[kind].emoji,
      })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

// --- Category list ------------------------------------------------------------------

export function buildStashList(character: CharacterDoc, state: StashBrowseState, page: StashResolvedPage, note?: string): InventoryView {
   const shown: StashBrowseState = { ...state, page: page.page };
   const kind = ITEM_KINDS[state.kind];
   const container = STORAGE_CONTAINERS[state.container];

   const lines = page.items.map((item) => {
      const quantity = item.instance.quantity > 1 ? ` ×${item.instance.quantity}` : '';
      return `${kind.emoji} **${itemDisplayName(item)}**${quantity} — ${lineSummary(item)}`;
   });

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`${kind.emoji} ${kind.name} — ${container.name}`)
      .setDescription([note, lines.join('\n') || '*Nothing of this sort is stored here.*'].filter(Boolean).join('\n\n'))
      .setFooter({ text: `Page ${page.page + 1}/${page.pageCount} · ${page.totalCount} ${page.totalCount === 1 ? 'entry' : 'entries'} · ${STASH_SORTS[state.sort].name}` });

   const components: Row[] = [];
   const picker = itemPickRow(character, shown, page.items);
   if (picker)
      components.push(picker);
   components.push(sortRow(character, shown), navRow(character, shown, page.pageCount));

   return { embeds: [embed], components };
}

function itemPickRow(character: CharacterDoc, state: StashBrowseState, items: ResolvedItem[]): Row | null {
   if (items.length === 0)
      return null;

   const menu = new StringSelectMenuBuilder()
      .setCustomId(`stash:pick:${character._id}:${packStashState(state)}`)
      .setPlaceholder('Inspect an item…')
      .addOptions(items.map((item) => ({
         label: truncate(`${itemDisplayName(item)}${item.instance.quantity > 1 ? ` ×${item.instance.quantity}` : ''}`, 100),
         value: item.instance.instanceId,
         description: truncate(lineSummary(item), 100),
      })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function sortRow(character: CharacterDoc, state: StashBrowseState): Row {
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`stash:sort:${character._id}:${packStashState(state)}`)
      .setPlaceholder(`Sort: ${STASH_SORTS[state.sort].name}`)
      .addOptions((Object.keys(STASH_SORTS) as StashSortId[]).map((sort) => ({
         label: STASH_SORTS[sort].name,
         value: sort,
         default: sort === state.sort,
      })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function navRow(character: CharacterDoc, state: StashBrowseState, pageCount: number): Row {
   const target = (page: number) => `stash:list:${character._id}:${packStashState({ ...state, page })}`;

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(target(state.page - 1)).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(state.page === 0),
      new ButtonBuilder().setCustomId(`stash:home:${character._id}:${state.container}`).setLabel('Stash').setEmoji('🗄️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(target(state.page + 1)).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(state.page >= pageCount - 1),
   );
}

// --- Item card --------------------------------------------------------------------------

/** The stat card (same renderer as `/inventory`) + a Withdraw action. */
export function buildStashCard(character: CharacterDoc, state: StashBrowseState, item: ResolvedItem, note?: string): InventoryView {
   const embed = detailEmbed(character, item, note);
   const suffix = `${character._id}:${item.instance.instanceId}:${packStashState(state)}`;

   const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`stash:withdraw:${suffix}`).setLabel('Withdraw').setEmoji('📤').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`stash:list:${character._id}:${packStashState(state)}`).setLabel('Back').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
   );

   return { embeds: [embed], components: [row] };
}

function truncate(text: string, max: number): string {
   return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
