// Discord adapter (marked): the inventory panel (D28) — hub (equipment +
// categories) → category list (sorted, paged) → item detail (stat card +
// actions). Stateless like every panel: the character id, the inspected
// instance id and the packed browse state (category.sort.page) ride in the
// customIds, and every view renders from a FRESH doc read — so two open panels
// can never show a phantom item as actionable for long, and buttons survive
// restarts. Underscore prefix → loader skips it.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import { ATTRIBUTES, type AttributeKey } from '../../game/data/attributes.js';
import { RESOURCES } from '../../game/data/resources.js';
import { EQUIPMENT_SLOTS, EQUIPMENT_SLOT_IDS } from '../../game/data/equipmentSlots.js';
import {
   ITEM_KINDS,
   ITEM_KIND_IDS,
   ITEM_QUALITIES,
   MATERIALS,
   WEAPON_PROPERTIES,
   WEAPON_REACH,
   isEquippable,
   type ItemDefinition,
} from '../../game/data/items.js';
import { FORAGE_FAMILIES, foragableInfo, isForagableId } from '../../game/data/foragables.js';
import { EXAMINE_AP_COST } from '../../game/professions/identify.js';
import {
   INVENTORY_SORTS,
   browseItems,
   browseState,
   carriedWeightKg,
   carryCapacityKg,
   equipmentAttributeModifiers,
   equipmentOf,
   equippedItems,
   findItem,
   identificationOf,
   itemDisplayName,
   itemValue,
   kindCounts,
   maxDurability,
   packBrowseState,
   perceivedDefinition,
   qualityOf,
   slotOfInstance,
   totalEquippedArmor,
   unmetRequirements,
   type BrowseState,
   type InventorySortId,
   type ResolvedItem,
} from '../../game/character/inventory.js';
import { displayName } from '../../game/character/identity.js';
import { roundTo } from '../../lib/number.js';
import type { CharacterDoc } from '../../db/models/character.js';

const PANEL_COLOR = 0x8B5E34; // saddle leather

export interface InventoryView {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

type Row = ActionRowBuilder<MessageActionRowComponentBuilder>;

// --- Hub -----------------------------------------------------------------------

/** The landing view: worn gear, load, and category tabs. `note` is an optional
 *  result line ('✅ Dropped…') prepended after an action repaints the panel. */
export function buildInventoryHub(character: CharacterDoc, note?: string): InventoryView {
   const equipment = equipmentOf(character);

   const slotLines = EQUIPMENT_SLOT_IDS.map((slot) => {
      const def = EQUIPMENT_SLOTS[slot];
      const instanceId = equipment[slot];
      const item = instanceId ? findItem(character, instanceId) : null;
      return `${def.emoji} **${def.name}** — ${item ? itemDisplayName(item) : '*nothing*'}`;
   });

   const counts = kindCounts(character);
   const countLine = ITEM_KIND_IDS
      .map((kind) => `${ITEM_KINDS[kind].emoji} ${counts[kind]}`)
      .join(' · ');

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`🎒 ${displayName(character)} — inventory`)
      .addFields(
         { name: 'Equipment', value: slotLines.join('\n') },
         { name: 'Protection & load', value: `🛡️ Armor **${totalEquippedArmor(character)}**${modifierSummary(character)}\n${loadLine(character)}`, inline: true },
         { name: 'Pack', value: countLine, inline: true },
      )
      .setFooter({ text: 'Pick a category to browse · inspect worn gear to unequip it' });

   if (note)
      embed.setDescription(note);

   const components: Row[] = [categoryRow(character)];
   const worn = equippedRow(character);
   if (worn)
      components.push(worn);

   return { embeds: [embed], components };
}

function categoryRow(character: CharacterDoc): Row {
   const counts = kindCounts(character);
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`inventory:cat:${character._id}`)
      .setPlaceholder('Browse a category…')
      .addOptions(ITEM_KIND_IDS.map((kind) => ({
         label: `${ITEM_KINDS[kind].name} (${counts[kind]})`,
         value: kind,
         emoji: ITEM_KINDS[kind].emoji,
      })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function equippedRow(character: CharacterDoc): Row | null {
   const worn = equippedItems(character);
   if (worn.length === 0)
      return null;

   const menu = new StringSelectMenuBuilder()
      .setCustomId(`inventory:equipped:${character._id}`)
      .setPlaceholder('Inspect worn gear…')
      .addOptions(worn.map(({ slot, item }) => ({
         label: truncate(`${EQUIPMENT_SLOTS[slot].name} — ${itemDisplayName(item)}`, 100),
         value: item.instance.instanceId,
         description: truncate(lineSummary(item), 100),
         emoji: ITEM_KINDS[item.definition.kind].emoji,
      })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

// --- Category list ------------------------------------------------------------------

export function buildInventoryList(character: CharacterDoc, state: BrowseState, note?: string): InventoryView {
   const page = browseItems(character, state);
   const shown: BrowseState = { ...state, page: page.page };
   const kind = ITEM_KINDS[state.kind];

   const lines = page.items.map((item) => {
      const slot = slotOfInstance(character, item.instance.instanceId);
      const equipped = slot ? ` · *equipped — ${EQUIPMENT_SLOTS[slot].name.toLowerCase()}*` : '';
      const quantity = item.instance.quantity > 1 ? ` ×${item.instance.quantity}` : '';
      return `${kind.emoji} **${itemDisplayName(item)}**${quantity} — ${lineSummary(item)}${equipped}`;
   });

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`${kind.emoji} ${kind.name} — ${displayName(character)}`)
      .setDescription([note, lines.join('\n') || '*Nothing here. The road provides — sometimes.*'].filter(Boolean).join('\n\n'))
      .setFooter({ text: `Page ${page.page + 1}/${page.pageCount} · ${page.totalCount} ${page.totalCount === 1 ? 'entry' : 'entries'} · ${INVENTORY_SORTS[state.sort].name} · ${loadLine(character)}` });

   const components: Row[] = [];
   const picker = itemPickRow(character, shown, page.items);
   if (picker)
      components.push(picker);
   components.push(sortRow(character, shown), navRow(character, shown, page.pageCount));

   return { embeds: [embed], components };
}

function itemPickRow(character: CharacterDoc, state: BrowseState, items: ResolvedItem[]): Row | null {
   if (items.length === 0)
      return null;

   const menu = new StringSelectMenuBuilder()
      .setCustomId(`inventory:pick:${character._id}:${packBrowseState(state)}`)
      .setPlaceholder('Inspect an item…')
      .addOptions(items.map((item) => {
         const slot = slotOfInstance(character, item.instance.instanceId);
         return {
            label: truncate(`${itemDisplayName(item)}${item.instance.quantity > 1 ? ` ×${item.instance.quantity}` : ''}`, 100),
            value: item.instance.instanceId,
            description: truncate(`${slot ? `📌 ${EQUIPMENT_SLOTS[slot].name} · ` : ''}${lineSummary(item)}`, 100),
         };
      }));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function sortRow(character: CharacterDoc, state: BrowseState): Row {
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`inventory:sort:${character._id}:${packBrowseState(state)}`)
      .setPlaceholder(`Sort: ${INVENTORY_SORTS[state.sort].name}`)
      .addOptions((Object.keys(INVENTORY_SORTS) as InventorySortId[]).map((sort) => ({
         label: INVENTORY_SORTS[sort].name,
         value: sort,
         default: sort === state.sort,
      })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function navRow(character: CharacterDoc, state: BrowseState, pageCount: number): Row {
   const target = (page: number) => `inventory:list:${character._id}:${packBrowseState({ ...state, page })}`;

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(target(state.page - 1)).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(state.page === 0),
      new ButtonBuilder().setCustomId(`inventory:home:${character._id}`).setLabel('Inventory').setEmoji('🎒').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(target(state.page + 1)).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(state.page >= pageCount - 1),
   );
}

// --- Item detail -----------------------------------------------------------------------

/** The stat card + contextual actions for one owned item. Returns null when
 *  the instance no longer exists (dropped from another window) — the caller
 *  falls back to the list with an explanation. */
export function buildItemDetail(character: CharacterDoc, instanceId: string, state: BrowseState, note?: string): InventoryView | null {
   const item = findItem(character, instanceId);
   if (!item)
      return null;

   const embed = detailEmbed(character, item, note);
   const buttons = detailButtons(character, item, state);

   return { embeds: [embed], components: [buttons] };
}

/** The 'are you sure' repaint of the detail view for a drop. */
export function buildDropConfirm(character: CharacterDoc, instanceId: string, state: BrowseState): InventoryView | null {
   const item = findItem(character, instanceId);
   if (!item)
      return null;

   const quantity = item.instance.quantity > 1 ? ` ×${item.instance.quantity}` : '';
   const embed = detailEmbed(character, item, `⚠️ Drop **${itemDisplayName(item)}**${quantity}? It will be gone for good.`);
   const suffix = actionSuffix(character._id, instanceId, state);

   const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`inventory:dropc:${suffix}`).setLabel('Drop it').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`inventory:detail:${suffix}`).setLabel('Keep it').setStyle(ButtonStyle.Secondary),
   );

   return { embeds: [embed], components: [row] };
}

/** Slot picker for items that fit more than one slot (dagger → main/off hand).
 *  Each option surfaces the slot's current occupant (Ruleset "equipped items
 *  surfaced in the equip dropdowns") so the player sees what they'd displace
 *  before committing — the actual swap-and-stow already happens in `planEquip`. */
export function buildSlotChooser(character: CharacterDoc, instanceId: string, state: BrowseState): InventoryView | null {
   const item = findItem(character, instanceId);
   if (!item || !isEquippable(item.definition))
      return null;

   const equipment = equipmentOf(character);
   const embed = detailEmbed(character, item, `Where do you want to wear **${itemDisplayName(item)}**?`);
   const suffix = actionSuffix(character._id, instanceId, state);

   const menu = new StringSelectMenuBuilder()
      .setCustomId(`inventory:equipsel:${suffix}`)
      .setPlaceholder('Choose a slot…')
      .addOptions(item.definition.slots.map((slot) => {
         const occupantId = equipment[slot];
         const occupant = occupantId ? findItem(character, occupantId) : null;
         return {
            label: EQUIPMENT_SLOTS[slot].name,
            value: slot,
            emoji: EQUIPMENT_SLOTS[slot].emoji,
            description: truncate(occupant ? `📌 Equipped: ${itemDisplayName(occupant)}` : 'Empty', 100),
         };
      }));

   const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
   const cancelRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`inventory:detail:${suffix}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
   );

   return { embeds: [embed], components: [row, cancelRow] };
}

/** The item stat card. Exported so the stash panel (D33) reuses the exact same
 *  renderer — a stashed item shows an identical card (it is never equipped, so
 *  no 'Equipped' line appears). Renders the owner's BELIEF (R16): a mislabeled
 *  find shows its apparent item's card wholesale; an unidentified one hides
 *  everything but its look and its (real, physical) weight. */
export function detailEmbed(character: CharacterDoc, item: ResolvedItem, note?: string): EmbedBuilder {
   if (identificationOf(item.instance) === 'unidentified')
      return mysteryEmbed(item, note);

   const def = perceivedDefinition(item);
   const quality = ITEM_QUALITIES[qualityOf(item.instance)];
   const slot = slotOfInstance(character, item.instance.instanceId);

   const headline = [
      slot ? `📌 Equipped — ${EQUIPMENT_SLOTS[slot].name}` : '',
      note ?? '',
      `*${def.description}*`,
   ].filter(Boolean).join('\n\n');

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`${ITEM_KINDS[def.kind].emoji} ${itemDisplayName(item)}${item.instance.quantity > 1 ? ` ×${item.instance.quantity}` : ''}`)
      .setDescription(headline)
      .addFields(
         ...statFields(character, item),
         {
            name: 'In the hand',
            value: [
               `Quality: **${quality.name}**`,
               def.material ? `Material: **${MATERIALS[def.material].name}**` : '',
               // Weight is a physical fact — always the REAL definition's.
               `Weight: **${formatKg(item.definition.weightKg)}**${item.instance.quantity > 1 ? ` (stack ${formatKg(item.definition.weightKg * item.instance.quantity)})` : ''}`,
               `Value: **${itemValue(item)}** 🪙`,
            ].filter(Boolean).join('\n'),
            inline: true,
         },
      );

   return embed;
}

/** The card of an honest unknown: its look, its family, its weight — and
 *  nothing else. The mystery is the pitch (professions.md R16). */
function mysteryEmbed(item: ResolvedItem, note?: string): EmbedBuilder {
   const family = foragableInfo(item.instance.itemId);
   const singular = family ? FORAGE_FAMILIES[family.family].singular : 'find';

   return new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`${ITEM_KINDS[item.definition.kind].emoji} ${itemDisplayName(item)}${item.instance.quantity > 1 ? ` ×${item.instance.quantity}` : ''}`)
      .setDescription([
         note ?? '',
         `*You cannot yet say which ${singular} this is. A keener eye might.*`,
      ].filter(Boolean).join('\n\n'))
      .addFields({
         name: 'In the hand',
         value: [
            `Weight: **${formatKg(item.definition.weightKg)}**`,
            'Value: **?** 🪙',
         ].join('\n'),
         inline: true,
      });
}

/** The kind-specific stat block (of the PERCEIVED definition — a mislabel
 *  shows its false stats, R16). Extend with a case when a new kind lands. */
function statFields(character: CharacterDoc, item: ResolvedItem): { name: string; value: string; inline?: boolean }[] {
   const def = perceivedDefinition(item);

   if (def.kind === 'weapon') {
      const properties = (def.properties ?? [])
         .map((id) => `**${WEAPON_PROPERTIES[id].name}** — ${WEAPON_PROPERTIES[id].description}`)
         .join('\n');

      return [
         {
            name: 'Weapon',
            value: [
               `Damage: **${def.damage.min}–${def.damage.max}**`,
               `Reach: **${WEAPON_REACH[def.reach].name}**`,
               `Grip: **${def.hands === 2 ? 'Two-handed' : 'One-handed'}**`,
               durabilityLine(item),
               requirementLine(character, item),
               modifierLine(item),
            ].filter(Boolean).join('\n'),
            inline: true,
         },
         ...(properties ? [{ name: 'Properties', value: properties }] : []),
      ];
   }

   if (def.kind === 'shield' || def.kind === 'armor')
      return [{
         name: def.kind === 'shield' ? 'Shield' : 'Armor',
         value: [
            `Armor value: **${def.armor}**`,
            durabilityLine(item),
            requirementLine(character, item),
            modifierLine(item),
         ].filter(Boolean).join('\n'),
         inline: true,
      }];

   if (def.kind === 'consumable') {
      const effects = Object.entries(def.effects)
         .map(([key, amount]) => `**${amount > 0 ? '+' : ''}${amount}** ${RESOURCES[key as keyof typeof RESOURCES].name}`)
         .join(' · ');

      return [{ name: 'On use', value: effects || '*Nothing measurable.*', inline: true }];
   }

   // Materials and clutter carry no stat block — weight/value say it all.
   return [];
}

function detailButtons(character: CharacterDoc, item: ResolvedItem, state: BrowseState): Row {
   const def = item.definition;
   const suffix = actionSuffix(character._id, item.instance.instanceId, state);
   const equippedSlot = slotOfInstance(character, item.instance.instanceId);
   const buttons: ButtonBuilder[] = [];

   if (isEquippable(def))
      if (equippedSlot)
         buttons.push(new ButtonBuilder().setCustomId(`inventory:unequip:${suffix}`).setLabel('Unequip').setEmoji('🫳').setStyle(ButtonStyle.Secondary));
      else
         buttons.push(new ButtonBuilder().setCustomId(`inventory:equip:${suffix}`).setLabel('Equip').setEmoji('🫴').setStyle(ButtonStyle.Primary));

   if (def.kind === 'consumable')
      buttons.push(new ButtonBuilder().setCustomId(`inventory:use:${suffix}`).setLabel('Use').setEmoji('🍽️').setStyle(ButtonStyle.Primary));

   // Examine (R16): offered on EVERY foraged find, identified or not — a
   // settled-only button would leak which confident labels are actually wrong.
   if (isForagableId(item.instance.itemId))
      buttons.push(new ButtonBuilder().setCustomId(`inventory:examine:${suffix}`).setLabel(`Examine (${EXAMINE_AP_COST} AP)`).setEmoji('🔍').setStyle(ButtonStyle.Primary));

   // Stow into the stash (D33) — only when not worn (unequip first); a fresh
   // read on the click side re-checks. Whole entry moves; open it in `/stash`.
   if (!equippedSlot)
      buttons.push(new ButtonBuilder().setCustomId(`inventory:store:${suffix}`).setLabel('Store').setEmoji('🗄️').setStyle(ButtonStyle.Secondary));

   buttons.push(
      new ButtonBuilder().setCustomId(`inventory:drop:${suffix}`).setLabel('Drop').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`inventory:list:${character._id}:${packBrowseState(state)}`).setLabel('Back').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
   );

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);
}

// --- Shared bits -------------------------------------------------------------------------

/** The default browse state to return to from an item of this definition. */
export function stateForItem(definition: ItemDefinition): BrowseState {
   return browseState(definition.kind);
}

function actionSuffix(characterId: string, instanceId: string, state: BrowseState): string {
   return `${characterId}:${instanceId}:${packBrowseState(state)}`;
}

/** One-line stat summary for list rows and select descriptions. Exported for
 *  the stash panel to render identical rows (D33). Reads the PERCEIVED
 *  definition (R16) — an unknown admits it, a mislabel keeps lying. */
export function lineSummary(item: ResolvedItem): string {
   if (identificationOf(item.instance) === 'unidentified')
      return `unidentified · ${formatKg(item.definition.weightKg)}`;

   const def = perceivedDefinition(item);

   if (def.kind === 'weapon')
      return `${def.damage.min}–${def.damage.max} dmg · ${WEAPON_REACH[def.reach].name.toLowerCase()} · ${formatKg(def.weightKg)}`;
   if (def.kind === 'shield' || def.kind === 'armor')
      return `AV ${def.armor} · ${formatKg(def.weightKg)}`;
   if (def.kind === 'consumable') {
      const effects = Object.entries(def.effects).map(([key, amount]) => `${amount > 0 ? '+' : ''}${amount} ${RESOURCES[key as keyof typeof RESOURCES].name}`).join(', ');
      return `${effects || 'no effect'} · ${formatKg(def.weightKg)}`;
   }

   // Weight is physical — the REAL definition's, so a list row can never
   // contradict the card and betray a mislabel.
   return `${itemValue(item)} 🪙 · ${formatKg(item.definition.weightKg)}`;
}

function durabilityLine(item: ResolvedItem): string {
   const max = maxDurability(item.definition, qualityOf(item.instance));
   if (max === null)
      return '';

   const current = Math.min(item.instance.durability ?? max, max);
   return `Durability: **${current}/${max}**${current === 0 ? ' — *broken*' : ''}`;
}

function requirementLine(character: CharacterDoc, item: ResolvedItem): string {
   if (!isEquippable(item.definition))
      return '';

   const requirements = Object.entries(item.definition.attributeRequirements ?? {});
   if (requirements.length === 0)
      return '';

   const unmet = new Set(unmetRequirements(character, item.definition).map((entry) => entry.attribute));
   const parts = requirements.map(([key, required]) =>
      `${ATTRIBUTES[key as AttributeKey].abbreviation} ${required} ${unmet.has(key as AttributeKey) ? '✗' : '✓'}`);

   return `Requires: **${parts.join(' · ')}**`;
}

function modifierLine(item: ResolvedItem): string {
   if (!isEquippable(item.definition))
      return '';

   const modifiers = Object.entries(item.definition.attributeModifiers ?? {});
   if (modifiers.length === 0)
      return '';

   const parts = modifiers.map(([key, shift]) => `${ATTRIBUTES[key as AttributeKey].abbreviation} ${shift > 0 ? '+' : ''}${shift}`);
   return `While worn: **${parts.join(' · ')}**`;
}

/** '⚖️ 23.4/30 kg' (+ a warning when over capacity — display-only for now). */
function loadLine(character: CharacterDoc): string {
   const carried = carriedWeightKg(character);
   const capacity = carryCapacityKg(character);
   return `⚖️ ${formatKg(carried, false)}/${formatKg(capacity)}${carried > capacity ? ' — *overloaded!*' : ''}`;
}

function modifierSummary(character: CharacterDoc): string {
   const modifiers = Object.entries(equipmentAttributeModifiers(character));
   if (modifiers.length === 0)
      return '';

   const parts = modifiers.map(([key, shift]) => `${ATTRIBUTES[key as AttributeKey].abbreviation} ${shift > 0 ? '+' : ''}${shift}`);
   return ` · ${parts.join(' · ')}`;
}

function formatKg(kg: number, unit = true): string {
   return `${roundTo(kg, 1)}${unit ? ' kg' : ''}`;
}

function truncate(text: string, max: number): string {
   return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
