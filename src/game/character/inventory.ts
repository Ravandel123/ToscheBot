import { randomUUID } from 'node:crypto';
import { type AttributeKey, ATTRIBUTE_KEYS } from '../data/attributes.js';
import { EQUIPMENT_SLOT_IDS, isEquipmentSlotId, type EquipmentSlotId } from '../data/equipmentSlots.js';
import {
   DEFAULT_ITEM_QUALITY,
   ITEM_KINDS,
   ITEM_KIND_IDS,
   ITEM_QUALITIES,
   isEquippable,
   isItemQualityId,
   itemDefinition,
   type EquippableDefinition,
   type ItemDefinition,
   type ItemKindId,
   type ItemQualityId,
} from '../data/items.js';
import type { CharacterDoc } from '../../db/models/character.js';

// Pure inventory & equipment rules (D28) — no Discord, no DB. The DB stores
// ITEM INSTANCES on the character; everything static resolves from the catalog
// at read time (D10). All mutations are planned here and applied atomically by
// inventoryService; the panel renders exclusively from a fresh doc, so a stale
// button (item dropped from another window) degrades to a friendly error, never
// a corrupt write.

// An owned item. `quality` is per instance (one catalog entry drops at any
// craftsmanship tier); `durability` exists only for equippable kinds;
// `quantity` > 1 only for stackable kinds (stack key = itemId + quality).
export interface ItemInstance {
   /** Short unique id within the owning character — rides in customIds. */
   instanceId: string;
   /** Catalog id; typed loosely because a stored id can outlive a rename (D10 rule 3). */
   itemId: string;
   quality: ItemQualityId;
   quantity: number;
   /** Current durability (max = catalog durabilityMax × quality multiplier). */
   durability?: number;
   acquiredAt: Date;
}

/** The slice of a character the inventory rules read. Fields are optional so
 *  pre-D28 docs (and partial test doubles) read as an empty pack. */
export interface InventoryState {
   inventory?: ItemInstance[];
   equipment?: Partial<Record<string, string>>;
}

/** Inventory plus the attributes equip requirements are checked against. */
export type EquipSubject = InventoryState & Pick<CharacterDoc, 'attributes'>;

export interface ResolvedItem {
   instance: ItemInstance;
   definition: ItemDefinition;
}

/** Hard cap on distinct inventory entries (stacks/instances) — bounds the
 *  embedded array on the free-tier cluster. 🟡 tunable. */
export const INVENTORY_STACK_LIMIT = 50;

export const INVENTORY_PAGE_SIZE = 10;

// --- Reading the pack ---------------------------------------------------------

export function inventoryOf(character: InventoryState): ItemInstance[] {
   return character.inventory ?? [];
}

/** The equipment map with unknown slot ids filtered out (a retired slot
 *  degrades to 'nothing equipped there', D10 rule 3). */
export function equipmentOf(character: InventoryState): Partial<Record<EquipmentSlotId, string>> {
   const entries = Object.entries(character.equipment ?? {})
      .filter(([slot, instanceId]) => isEquipmentSlotId(slot) && typeof instanceId === 'string');

   return Object.fromEntries(entries);
}

/** All owned items with their catalog definitions; unknown item ids are
 *  dropped from view (they stay in the doc untouched — D10 rule 3). */
export function resolveInventory(character: InventoryState): ResolvedItem[] {
   return inventoryOf(character).flatMap((instance) => {
      const definition = itemDefinition(instance.itemId);
      return definition ? [{ instance, definition }] : [];
   });
}

export function findItem(character: InventoryState, instanceId: string): ResolvedItem | null {
   const instance = inventoryOf(character).find((item) => item.instanceId === instanceId);
   if (!instance)
      return null;

   const definition = itemDefinition(instance.itemId);
   return definition ? { instance, definition } : null;
}

/** The instance's craftsmanship tier, tolerating stale stored values. */
export function qualityOf(instance: ItemInstance): ItemQualityId {
   return isItemQualityId(instance.quality) ? instance.quality : DEFAULT_ITEM_QUALITY;
}

// --- Display helpers ------------------------------------------------------------

/** 'Battered Iron Sword' / 'Iron Sword' / 'Masterwork Iron Sword'. */
export function itemDisplayName(item: ResolvedItem): string {
   const prefix = ITEM_QUALITIES[qualityOf(item.instance)].prefix;
   return prefix ? `${prefix} ${item.definition.name}` : item.definition.name;
}

/** 🪙 per unit, quality-scaled. Display-only until the economy layer (D19). */
export function itemValue(item: ResolvedItem): number {
   return Math.max(0, Math.round(item.definition.value * ITEM_QUALITIES[qualityOf(item.instance)].valueMultiplier));
}

/** Durability ceiling for the instance, or null for kinds without durability. */
export function maxDurability(definition: ItemDefinition, quality: ItemQualityId): number | null {
   if (!isEquippable(definition))
      return null;

   return Math.max(1, Math.round(definition.durabilityMax * ITEM_QUALITIES[quality].durabilityMultiplier));
}

/** A broken equippable (durability 0) cannot be worn/wielded. */
export function isBroken(item: ResolvedItem): boolean {
   return isEquippable(item.definition) && (item.instance.durability ?? 1) <= 0;
}

// --- Weight & encumbrance --------------------------------------------------------

export function stackWeightKg(item: ResolvedItem): number {
   return item.definition.weightKg * item.instance.quantity;
}

/** Everything owned weighs you down, worn or packed. */
export function carriedWeightKg(character: InventoryState): number {
   return resolveInventory(character).reduce((sum, item) => sum + stackWeightKg(item), 0);
}

/** 🟡 Placeholder capacity: a character can lug their Strength in kilograms.
 *  The Phase 7 ruleset owns the real encumbrance formula (RPG/ §3 carry). */
export function carryCapacityKg(character: Pick<CharacterDoc, 'attributes'>): number {
   return character.attributes.strength;
}

// --- Adding items (stacking + caps) ------------------------------------------------

/** The existing stack a grant of (itemId, quality) merges into, if any. */
export function findStack(character: InventoryState, itemId: string, quality: ItemQualityId): ItemInstance | null {
   const definition = itemDefinition(itemId);
   if (!definition || !ITEM_KINDS[definition.kind].stackable)
      return null;

   return inventoryOf(character).find((item) => item.itemId === itemId && qualityOf(item) === quality) ?? null;
}

export type AddItemsCheck =
   | { ok: true; stackWith: ItemInstance | null }
   | { ok: false; reason: 'inventory-full' | 'too-heavy' };

/** Whether `quantity` of an item fits (stack limit + carry capacity). */
export function canAddItems(character: EquipSubject, itemId: string, definition: ItemDefinition, quality: ItemQualityId, quantity: number): AddItemsCheck {
   const stackWith = findStack(character, itemId, quality);
   const stackable = ITEM_KINDS[definition.kind].stackable;
   const newEntries = stackWith ? 0 : (stackable ? 1 : quantity);

   if (inventoryOf(character).length + newEntries > INVENTORY_STACK_LIMIT)
      return { ok: false, reason: 'inventory-full' };

   if (carriedWeightKg(character) + definition.weightKg * quantity > carryCapacityKg(character))
      return { ok: false, reason: 'too-heavy' };

   return { ok: true, stackWith };
}

/** Mints a fresh instance with a short id unique within the owning pack. */
export function createItemInstance(itemId: string, definition: ItemDefinition, quality: ItemQualityId, quantity: number, existingIds: ReadonlySet<string>): ItemInstance {
   const durabilityMax = maxDurability(definition, quality);

   return {
      instanceId: mintInstanceId(existingIds),
      itemId,
      quality,
      quantity,
      ...(durabilityMax === null ? {} : { durability: durabilityMax }),
      acquiredAt: new Date(),
   };
}

// 8 hex chars of a v4 uuid — short enough for customIds, unique enough within
// one character's ≤ INVENTORY_STACK_LIMIT entries (collisions are re-rolled).
/** A short instance handle not present in `existingIds` (re-rolled on collision).
 *  Reused for pack instances AND for a withdrawn item's fresh pack id (D33). */
export function mintInstanceId(existingIds: ReadonlySet<string>): string {
   let instanceId = shortInstanceId();
   while (existingIds.has(instanceId))
      instanceId = shortInstanceId();

   return instanceId;
}

function shortInstanceId(): string {
   return randomUUID().slice(0, 8);
}

// --- Equipped gear ------------------------------------------------------------------

export function slotOfInstance(character: InventoryState, instanceId: string): EquipmentSlotId | null {
   const equipment = equipmentOf(character);
   return EQUIPMENT_SLOT_IDS.find((slot) => equipment[slot] === instanceId) ?? null;
}

/** Worn/wielded items in slot-catalog order (dangling references skipped). */
export function equippedItems(character: InventoryState): { slot: EquipmentSlotId; item: ResolvedItem }[] {
   const equipment = equipmentOf(character);

   return EQUIPMENT_SLOT_IDS.flatMap((slot) => {
      const instanceId = equipment[slot];
      const item = instanceId ? findItem(character, instanceId) : null;
      return item ? [{ slot, item }] : [];
   });
}

/** 🟡 Total Armor Value of everything worn (Soak math comes with Phase 7). */
export function totalEquippedArmor(character: InventoryState): number {
   return equippedItems(character).reduce((sum, { item }) => {
      const def = item.definition;
      return sum + (def.kind === 'armor' || def.kind === 'shield' ? def.armor : 0);
   }, 0);
}

/** Summed attribute shifts of all equipped gear (plate −10 agility…). */
export function equipmentAttributeModifiers(character: InventoryState): Partial<Record<AttributeKey, number>> {
   const modifiers: Partial<Record<AttributeKey, number>> = {};

   for (const { item } of equippedItems(character)) {
      const definition = item.definition;
      if (!isEquippable(definition) || !definition.attributeModifiers)
         continue;

      for (const [key, shift] of Object.entries(definition.attributeModifiers) as [AttributeKey, number][])
         modifiers[key] = (modifiers[key] ?? 0) + shift;
   }

   return modifiers;
}

/** Effective attributes WITH equipped gear applied (floored at 1) — what d100
 *  checks should roll against: a lutren in full plate swims like a brick. */
export function attributesWithEquipment(character: EquipSubject): Record<AttributeKey, number> {
   const modifiers = equipmentAttributeModifiers(character);

   return Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, Math.max(1, character.attributes[key] + (modifiers[key] ?? 0))]),
   ) as Record<AttributeKey, number>;
}

// --- Equip / unequip planning ---------------------------------------------------------

export interface UnmetRequirement {
   attribute: AttributeKey;
   required: number;
   actual: number;
}

/** Requirements are checked against BASE attributes (racial base + point-buy),
 *  never equipment-modified ones — otherwise donning order would decide what
 *  you can wear (heavy plate lowering agility could invalidate your boots). */
export function unmetRequirements(character: Pick<CharacterDoc, 'attributes'>, definition: EquippableDefinition): UnmetRequirement[] {
   return Object.entries(definition.attributeRequirements ?? {}).flatMap(([key, required]) => {
      const attribute = key as AttributeKey;
      const actual = character.attributes[attribute];
      return actual < required ? [{ attribute, required, actual }] : [];
   });
}

export type EquipBlockReason = 'not-found' | 'not-equippable' | 'wrong-slot' | 'broken' | 'hands-full' | 'requirements';

export interface EquipPlan {
   /** The single slot → instanceId write of this equip. */
   set: Partial<Record<EquipmentSlotId, string>>;
   /** Slots to vacate (the item's previous slot, or the off hand for a 2H weapon). */
   clear: EquipmentSlotId[];
   /** Items this equip pushes out of their slots (they stay in the pack). */
   displaced: ResolvedItem[];
}

export type EquipCheck =
   | { ok: true; item: ResolvedItem; plan: EquipPlan }
   | { ok: false; reason: EquipBlockReason; unmet?: UnmetRequirement[] };

/** Validates equipping `instanceId` into `slot` and plans the atomic equipment-
 *  map changes. Swaps are implicit: whatever occupied the slot is displaced. */
export function planEquip(character: EquipSubject, instanceId: string, slot: EquipmentSlotId): EquipCheck {
   const item = findItem(character, instanceId);
   if (!item)
      return { ok: false, reason: 'not-found' };

   const definition = item.definition;
   if (!isEquippable(definition))
      return { ok: false, reason: 'not-equippable' };
   if (!definition.slots.includes(slot))
      return { ok: false, reason: 'wrong-slot' };
   if (isBroken(item))
      return { ok: false, reason: 'broken' };

   const unmet = unmetRequirements(character, definition);
   if (unmet.length > 0)
      return { ok: false, reason: 'requirements', unmet };

   const equipment = equipmentOf(character);
   const clear: EquipmentSlotId[] = [];
   const displaced: ResolvedItem[] = [];

   // Both hands are one resource: the off hand is unusable while a two-handed
   // weapon is wielded, and wielding one vacates the off hand.
   if (slot === 'offHand') {
      const main = equipment.mainHand ? findItem(character, equipment.mainHand) : null;
      if (main && main.instance.instanceId !== instanceId && isTwoHanded(main.definition))
         return { ok: false, reason: 'hands-full' };
   }

   if (isTwoHanded(definition) && equipment.offHand && equipment.offHand !== instanceId) {
      const offHandItem = findItem(character, equipment.offHand);
      if (offHandItem)
         displaced.push(offHandItem);
      clear.push('offHand');
   }

   // Moving an already-equipped item (dagger main → off hand) frees its old slot.
   const currentSlot = slotOfInstance(character, instanceId);
   if (currentSlot && currentSlot !== slot)
      clear.push(currentSlot);

   const occupant = equipment[slot];
   if (occupant && occupant !== instanceId) {
      const occupantItem = findItem(character, occupant);
      if (occupantItem)
         displaced.push(occupantItem);
   }

   return { ok: true, item, plan: { set: { [slot]: instanceId }, clear, displaced } };
}

export type UnequipCheck =
   | { ok: true; item: ResolvedItem; slot: EquipmentSlotId }
   | { ok: false; reason: 'not-equipped' };

export function planUnequip(character: InventoryState, instanceId: string): UnequipCheck {
   const item = findItem(character, instanceId);
   const slot = slotOfInstance(character, instanceId);

   if (!item || !slot)
      return { ok: false, reason: 'not-equipped' };

   return { ok: true, item, slot };
}

function isTwoHanded(definition: ItemDefinition): boolean {
   return definition.kind === 'weapon' && definition.hands === 2;
}

// --- Browsing (category / sort / page state riding in customIds) ------------------------

export interface InventorySortDefinition {
   name: string;
   compare(a: ResolvedItem, b: ResolvedItem): number;
}

export const INVENTORY_SORTS = {
   name: { name: 'Name (A→Z)', compare: (a, b) => itemDisplayName(a).localeCompare(itemDisplayName(b)) },
   weight: { name: 'Weight (heaviest first)', compare: (a, b) => stackWeightKg(b) - stackWeightKg(a) },
   value: { name: 'Value (richest first)', compare: (a, b) => itemValue(b) * b.instance.quantity - itemValue(a) * a.instance.quantity },
   newest: { name: 'Newest first', compare: (a, b) => acquiredTime(b) - acquiredTime(a) },
} as const satisfies Record<string, InventorySortDefinition>;

export type InventorySortId = keyof typeof INVENTORY_SORTS;

export const DEFAULT_INVENTORY_SORT: InventorySortId = 'name';

function acquiredTime(item: ResolvedItem): number {
   return item.instance.acquiredAt instanceof Date ? item.instance.acquiredAt.getTime() : 0;
}

/** Category + sort + page, packed as 'weapon.name.0' to ride in customIds. */
export interface BrowseState {
   kind: ItemKindId;
   sort: InventorySortId;
   page: number;
}

export function browseState(kind: ItemKindId, sort: InventorySortId = DEFAULT_INVENTORY_SORT, page = 0): BrowseState {
   return { kind, sort, page };
}

export function packBrowseState(state: BrowseState): string {
   return `${state.kind}.${state.sort}.${state.page}`;
}

/** Parses a packed browse state, falling back field-by-field on anything stale. */
export function parseBrowseState(raw: string | undefined): BrowseState {
   const [kind, sort, page] = (raw ?? '').split('.');
   const parsedPage = Number.parseInt(page ?? '', 10);

   return {
      kind: kind && kind in ITEM_KINDS ? kind as ItemKindId : ITEM_KIND_IDS[0],
      sort: sort && sort in INVENTORY_SORTS ? sort as InventorySortId : DEFAULT_INVENTORY_SORT,
      page: Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0,
   };
}

export interface BrowsePage {
   items: ResolvedItem[];
   /** The page actually shown (clamped — deletions can strand a stored page). */
   page: number;
   pageCount: number;
   totalCount: number;
}

/** The current page of one category, sorted. Page is clamped, never errored:
 *  dropping the last item of page 3 just lands you on the new last page. */
export function browseItems(character: InventoryState, state: BrowseState): BrowsePage {
   const filtered = resolveInventory(character)
      .filter((item) => item.definition.kind === state.kind)
      .sort(INVENTORY_SORTS[state.sort].compare);

   const pageCount = Math.max(1, Math.ceil(filtered.length / INVENTORY_PAGE_SIZE));
   const page = Math.min(Math.max(0, state.page), pageCount - 1);

   return {
      items: filtered.slice(page * INVENTORY_PAGE_SIZE, (page + 1) * INVENTORY_PAGE_SIZE),
      page,
      pageCount,
      totalCount: filtered.length,
   };
}

/** Stack counts per category — the hub's category select shows them. */
export function kindCounts(character: InventoryState): Record<ItemKindId, number> {
   const counts = Object.fromEntries(ITEM_KIND_IDS.map((kind) => [kind, 0])) as Record<ItemKindId, number>;

   for (const item of resolveInventory(character))
      counts[item.definition.kind] += 1;

   return counts;
}
