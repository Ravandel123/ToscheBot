import { MessageFlags, type ButtonInteraction, type StringSelectMenuInteraction } from 'discord.js';
import { ComponentHandler } from '../../types/interactions.js';
import { characterService } from '../../db/services/characterService.js';
import { inventoryService } from '../../db/services/inventoryService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { ATTRIBUTES } from '../../game/data/attributes.js';
import { RESOURCES, type ResourceKey } from '../../game/data/resources.js';
import { isEquipmentSlotId, type EquipmentSlotId } from '../../game/data/equipmentSlots.js';
import { isEquippable, type ConsumableDefinition } from '../../game/data/items.js';
import {
   INVENTORY_SORTS,
   browseState,
   findItem,
   itemDisplayName,
   parseBrowseState,
   planEquip,
   planUnequip,
   type BrowseState,
   type EquipCheck,
   type InventorySortId,
} from '../../game/character/inventory.js';
import { buildDropConfirm, buildInventoryHub, buildInventoryList, buildItemDetail, buildSlotChooser, stateForItem, type InventoryView } from './_inventoryPanel.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

// Handles every `inventory:*` interaction (D28). Two families:
//   NAVIGATION (home/cat/equipped/list/pick/sort/detail/drop) — read-only:
//     fetch a fresh doc, repaint. No lock needed; staleness self-heals because
//     nothing renders from the message, only from the DB.
//   MUTATIONS (equip/equipto/unequip/use/dropc) — read-decide-write: taken
//     under the character's lock (defer first — the ack window is ~3 s), with
//     a busy re-check inside. This is what makes two open panels safe: whoever
//     commits second finds the item gone/moved and gets a friendly note, never
//     a double-spend (the user-story race: drop in window B, equip in window A).
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

const STALE_ITEM_NOTE = '👻 That item is no longer in your pack.';
const BUSY_NOTE = '⏳ You are in the middle of something — deal with it first.';

export default {
   namespace: 'inventory',
   async handle(client, interaction) {
      const [, action, ...rest] = interaction.customId.split(':');

      if (interaction.isButton()) {
         if (action === 'home') return repaint(interaction, rest[0], (character) => buildInventoryHub(character));
         if (action === 'list') return repaint(interaction, rest[0], (character) => buildInventoryList(character, parseBrowseState(rest[1])));
         if (action === 'detail') return repaint(interaction, rest[0], (character) => detailOrList(character, rest[1], parseBrowseState(rest[2])));
         if (action === 'drop') return repaint(interaction, rest[0], (character) => buildDropConfirm(character, rest[1], parseBrowseState(rest[2])) ?? listFallback(character, parseBrowseState(rest[2])));
         if (action === 'equip') return handleEquip(client, interaction, rest[0], rest[1], parseBrowseState(rest[2]));
         if (action === 'equipto') return handleEquipTo(client, interaction, rest[0], rest[1], rest[2], parseBrowseState(rest[3]));
         if (action === 'unequip') return handleUnequip(client, interaction, rest[0], rest[1], parseBrowseState(rest[2]));
         if (action === 'use') return handleUse(client, interaction, rest[0], rest[1], parseBrowseState(rest[2]));
         if (action === 'dropc') return handleDropConfirmed(client, interaction, rest[0], rest[1], parseBrowseState(rest[2]));
         return;
      }

      if (interaction.isStringSelectMenu()) {
         // The category value doubles as a minimal packed state ('weapon' →
         // that kind, default sort, page 0 — parse falls back field by field).
         if (action === 'cat') return repaint(interaction, rest[0], (character) => buildInventoryList(character, parseBrowseState(interaction.values[0])));
         if (action === 'sort') return repaint(interaction, rest[0], (character) => {
            const state = parseBrowseState(rest[1]);
            const sort = interaction.values[0] in INVENTORY_SORTS ? interaction.values[0] as InventorySortId : state.sort;
            return buildInventoryList(character, { ...state, sort, page: 0 });
         });
         if (action === 'pick') return repaint(interaction, rest[0], (character) => detailOrList(character, interaction.values[0], parseBrowseState(rest[1])));
         if (action === 'equipped') return repaint(interaction, rest[0], (character) => {
            const item = findItem(character, interaction.values[0]);
            const state = item ? stateForItem(item.definition) : browseState('weapon');
            return detailOrList(character, interaction.values[0], state);
         });
      }
   },
} satisfies ComponentHandler;

type PanelInteraction = ButtonInteraction | StringSelectMenuInteraction;

// --- Navigation ---------------------------------------------------------------

/** Read-only repaint: fresh doc → view. The shared path of every nav action. */
async function repaint(interaction: PanelInteraction, characterId: string, view: (character: CharacterDoc) => InventoryView): Promise<void> {
   const character = await ownedCharacter(interaction, characterId);
   if (!character)
      return;

   await interaction.update(view(character));
}

/** Detail of an instance, or the list with a 'gone' note when it vanished. */
function detailOrList(character: CharacterDoc, instanceId: string, state: BrowseState, note?: string): InventoryView {
   return buildItemDetail(character, instanceId, state, note) ?? listFallback(character, state);
}

function listFallback(character: CharacterDoc, state: BrowseState): InventoryView {
   return buildInventoryList(character, state, STALE_ITEM_NOTE);
}

// --- Mutations -------------------------------------------------------------------

async function handleEquip(client: ToscheClient, interaction: ButtonInteraction, characterId: string, instanceId: string, state: BrowseState): Promise<void> {
   // Multi-slot items (a dagger fits either hand) detour to a slot chooser —
   // that's pure navigation; the real write happens in `equipto`.
   const character = await ownedCharacter(interaction, characterId);
   if (!character)
      return;

   const item = findItem(character, instanceId);
   if (item && isEquippable(item.definition) && item.definition.slots.length > 1) {
      await interaction.update(buildSlotChooser(character, instanceId, state) ?? listFallback(character, state));
      return;
   }

   const slot = item && isEquippable(item.definition) ? item.definition.slots[0] : null;
   await mutate(client, interaction, characterId, instanceId, state, async (fresh) =>
      equipResult(fresh, instanceId, slot, state));
}

async function handleEquipTo(client: ToscheClient, interaction: ButtonInteraction, characterId: string, instanceId: string, rawSlot: string, state: BrowseState): Promise<void> {
   const slot = isEquipmentSlotId(rawSlot) ? rawSlot : null;
   await mutate(client, interaction, characterId, instanceId, state, async (fresh) =>
      equipResult(fresh, instanceId, slot, state));
}

/** Validates + applies an equip against the FRESH doc and describes the outcome. */
async function equipResult(fresh: CharacterDoc, instanceId: string, slot: EquipmentSlotId | null, state: BrowseState): Promise<InventoryView> {
   if (!slot)
      return detailOrList(fresh, instanceId, state, STALE_ITEM_NOTE);

   const check: EquipCheck = planEquip(fresh, instanceId, slot);
   if (!check.ok)
      return detailOrList(fresh, instanceId, state, equipBlockNote(check));

   const applied = await inventoryService.applyEquipPlan(fresh._id, check.plan);
   if (!applied)
      return detailOrList(fresh, instanceId, state, STALE_ITEM_NOTE);

   const updated = await characterService.get(fresh._id) ?? fresh;
   const stowed = check.plan.displaced.map((item) => itemDisplayName(item)).join('**, **');
   const note = `✅ Equipped **${itemDisplayName(check.item)}**.${stowed ? ` You stow **${stowed}**.` : ''}`;
   return detailOrList(updated, instanceId, state, note);
}

function equipBlockNote(check: Exclude<EquipCheck, { ok: true }>): string {
   if (check.reason === 'requirements') {
      const parts = (check.unmet ?? []).map((entry) => `${ATTRIBUTES[entry.attribute].abbreviation} ${entry.required} (you have ${entry.actual})`);
      return `💪 It is beyond you: needs ${parts.join(', ')}.`;
   }

   const messages: Record<typeof check.reason, string> = {
      'not-found': STALE_ITEM_NOTE,
      'not-equippable': 'You cannot wear that.',
      'wrong-slot': 'It does not fit there.',
      'broken': '🛠️ It is broken — no smith has mended it yet.',
      'hands-full': '🙌 Your hands are full — a two-handed weapon needs both.',
   };
   return messages[check.reason];
}

async function handleUnequip(client: ToscheClient, interaction: ButtonInteraction, characterId: string, instanceId: string, state: BrowseState): Promise<void> {
   await mutate(client, interaction, characterId, instanceId, state, async (fresh) => {
      const check = planUnequip(fresh, instanceId);
      if (!check.ok)
         return detailOrList(fresh, instanceId, state, 'It is not equipped.');

      const cleared = await inventoryService.clearEquipmentSlot(fresh._id, check.slot);
      const updated = await characterService.get(fresh._id) ?? fresh;
      return detailOrList(updated, instanceId, state, cleared ? `✅ You stow **${itemDisplayName(check.item)}**.` : 'It is not equipped.');
   });
}

async function handleUse(client: ToscheClient, interaction: ButtonInteraction, characterId: string, instanceId: string, state: BrowseState): Promise<void> {
   await mutate(client, interaction, characterId, instanceId, state, async (fresh) => {
      const result = await inventoryService.consumeItem(fresh._id, instanceId);
      if (!result.ok)
         return detailOrList(fresh, instanceId, state, result.reason === 'not-consumable' ? 'You cannot use that.' : STALE_ITEM_NOTE);

      const updated = await characterService.get(fresh._id) ?? fresh;
      const note = `🍽️ You use **${result.definition.name}**${describeEffects(result.definition)}.`;

      // The last charge removes the stack — land on the list, not a ghost card.
      return result.depleted
         ? buildInventoryList(updated, state, note)
         : detailOrList(updated, instanceId, state, note);
   });
}

async function handleDropConfirmed(client: ToscheClient, interaction: ButtonInteraction, characterId: string, instanceId: string, state: BrowseState): Promise<void> {
   await mutate(client, interaction, characterId, instanceId, state, async (fresh) => {
      const item = findItem(fresh, instanceId);
      const result = await inventoryService.removeStack(fresh._id, instanceId);
      if (!result.ok)
         return buildInventoryList(fresh, state, STALE_ITEM_NOTE);

      const updated = await characterService.get(fresh._id) ?? fresh;
      const name = item ? itemDisplayName(item) : 'it';
      const quantity = result.removed.quantity > 1 ? ` ×${result.removed.quantity}` : '';
      return buildInventoryList(updated, state, `🗑️ Dropped **${name}**${quantity}. The road keeps what it is given.`);
   });
}

/**
 * The shared mutation path: ownership pre-check → refuse while in-memory
 * locked (mid-fight — don't queue a panel click behind a whole match) →
 * deferUpdate (the lock wait + DB writes may pass the 3 s ack window) →
 * under the lock: re-read, refuse while in a durable activity (gear is frozen
 * mid-adventure, D22-style busy), then run and repaint via editReply.
 */
async function mutate(
   client: ToscheClient,
   interaction: PanelInteraction,
   characterId: string,
   instanceId: string,
   state: BrowseState,
   run: (fresh: CharacterDoc) => Promise<InventoryView>,
): Promise<void> {
   const character = await ownedCharacter(interaction, characterId);
   if (!character)
      return;

   if (client.locks.isLocked(characterId)) {
      await interaction.reply({ content: BUSY_NOTE, ...ephemeral });
      return;
   }

   await interaction.deferUpdate();

   await client.locks.runExclusive([characterId], async () => {
      const fresh = await characterService.get(characterId);
      if (!fresh) {
         await interaction.editReply({ content: 'Your character vanished. Try `/inventory` again.', embeds: [], components: [] });
         return;
      }

      if (await activitySessionService.getActiveForParticipant(characterId)) {
         await interaction.editReply(detailOrList(fresh, instanceId, state, BUSY_NOTE));
         return;
      }

      await interaction.editReply(await run(fresh));
   });
}

// --- Helpers -----------------------------------------------------------------------

/** Fetches the character and verifies the clicker owns it (panels are personal). */
async function ownedCharacter(interaction: PanelInteraction, characterId: string): Promise<CharacterDoc | null> {
   const character = await characterService.get(characterId);
   if (character && character.ownerId === interaction.user.id)
      return character;

   await interaction.reply({ content: "That isn't your inventory.", ...ephemeral });
   return null;
}

function describeEffects(definition: ConsumableDefinition): string {
   const parts = Object.entries(definition.effects)
      .map(([key, amount]) => `${amount > 0 ? '+' : ''}${amount} ${RESOURCES[key as ResourceKey].name}`);

   return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
