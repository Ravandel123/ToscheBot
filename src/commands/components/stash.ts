import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { ComponentHandler } from '../../types/interactions.js';
import { characterService } from '../../db/services/characterService.js';
import { itemService } from '../../db/services/itemService.js';
import { INVENTORY_STACK_LIMIT, itemDisplayName } from '../../game/character/inventory.js';
import {
   STASH_SORTS,
   parseStashState,
   stashBrowseState,
   type StashBrowseState,
   type StashSortId,
} from '../../game/character/stash.js';
import { ITEM_KINDS, ITEM_KIND_IDS, type ItemKindId } from '../../game/data/items.js';
import { DEFAULT_CONTAINER, isStorageContainerId, type StorageContainerId } from '../../game/data/containers.js';
import { busyNote } from './_activities/registry.js';
import { deferIfFree, ownedCharacter, readyCharacter } from './_characterAction.js';
import { buildStashCard, buildStashHub, buildStashList, resolveStashDocs, type StashResolvedPage } from './_stashPanel.js';
import { quantitySuffix } from '../../lib/text.js';
import type { PanelView } from '../../lib/discord.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

// Handles every `stash:*` interaction. Same two families as the inventory
// panel:
//   NAVIGATION (home/cat/list/sort/pick/card) — read-only: fetch a fresh doc +
//     server-side stash page, repaint. No lock; staleness self-heals (views
//     render from the DB, never the message).
//   MUTATION (withdraw) — read-decide-write under the character lock (defer
//     first, busy re-check inside), so it is safe against the player's own
//     `/inventory` actions and never double-spends across two open panels.

const STALE_STASH_NOTE = '👻 That item is no longer in your stash.';

export default {
   namespace: 'stash',
   async handle(client, interaction) {
      const [, action, ...rest] = interaction.customId.split(':');

      if (interaction.isButton()) {
         if (action === 'home') return repaint(interaction, rest[0], (character) => loadHub(character, containerOf(rest[1])));
         if (action === 'list') return repaint(interaction, rest[0], (character) => loadList(character, parseStashState(rest[1])));
         if (action === 'withdraw') return handleWithdraw(client, interaction, rest[0], rest[1], parseStashState(rest[2]));
         return;
      }

      if (interaction.isStringSelectMenu()) {
         // The category value carries the kind; open its first page (default sort).
         if (action === 'cat') return repaint(interaction, rest[0], (character) => loadList(character, stashBrowseState(containerOf(rest[1]), kindValue(interaction.values[0]))));
         if (action === 'sort') return repaint(interaction, rest[0], (character) => {
            const state = parseStashState(rest[1]);
            const sort = interaction.values[0] in STASH_SORTS ? interaction.values[0] as StashSortId : state.sort;
            return loadList(character, { ...state, sort, page: 0 });
         });
         if (action === 'pick') return repaint(interaction, rest[0], (character) => loadCard(character, parseStashState(rest[1]), interaction.values[0]));
      }
   },
} satisfies ComponentHandler;

type PanelInteraction = ButtonInteraction | StringSelectMenuInteraction;

// --- View loaders (fetch from the Item collection, then render) ---------------------

async function loadHub(character: CharacterDoc, container: StorageContainerId): Promise<PanelView> {
   const counts = await itemService.countByKind(character._id, container);
   return buildStashHub(character, container, counts);
}

async function loadList(character: CharacterDoc, state: StashBrowseState, note?: string): Promise<PanelView> {
   const page = await itemService.browseStash(character._id, state.container, state.kind, state.sort, state.page);
   const resolved: StashResolvedPage = {
      items: resolveStashDocs(page.docs),
      page: page.page,
      pageCount: page.pageCount,
      totalCount: page.totalCount,
   };
   return buildStashList(character, state, resolved, note);
}

async function loadCard(character: CharacterDoc, state: StashBrowseState, instanceId: string, note?: string): Promise<PanelView> {
   const doc = await itemService.getStashItem(character._id, state.container, instanceId);
   const resolved = doc ? resolveStashDocs([doc])[0] : undefined;
   if (!resolved)
      return loadList(character, state, STALE_STASH_NOTE);

   return buildStashCard(character, state, resolved, note);
}

// --- Navigation ---------------------------------------------------------------

/** Read-only repaint: fresh character → view. */
async function repaint(interaction: PanelInteraction, characterId: string, view: (character: CharacterDoc) => Promise<PanelView>): Promise<void> {
   const character = await ownedCharacter(interaction, characterId, 'stash');
   if (!character)
      return;

   await interaction.update(await view(character));
}

// --- Withdraw (mutation) -------------------------------------------------------------

async function handleWithdraw(client: ToscheClient, interaction: ButtonInteraction, characterId: string, instanceId: string, state: StashBrowseState): Promise<void> {
   if (!await ownedCharacter(interaction, characterId, 'stash') || !await deferIfFree(client, interaction, characterId))
      return;

   await client.locks.runExclusive([characterId], async () => {
      // Gear is frozen mid-adventure — the stash is no exception.
      const fresh = await readyCharacter(interaction, characterId, {
         busyView: (session, character) => loadCard(character, state, instanceId, `${busyNote(session)} \`/play\` takes you back to it.`),
      });
      if (!fresh)
         return;

      const doc = await itemService.getStashItem(characterId, state.container, instanceId);
      const resolved = doc ? resolveStashDocs([doc])[0] : undefined;

      const result = await itemService.withdraw(characterId, state.container, instanceId);
      if (!result.ok) {
         await interaction.editReply(await loadList(fresh, state, withdrawBlockNote(result.reason)));
         return;
      }

      const updated = await characterService.get(characterId) ?? fresh;
      const withdrawn = resolved ? `**${itemDisplayName(resolved)}**${quantitySuffix(resolved.instance.quantity)}` : 'it';
      await interaction.editReply(await loadList(updated, state, `📤 Withdrew ${withdrawn}. It rides in your pack now.`));
   });
}

function withdrawBlockNote(reason: 'not-found' | 'unknown-container' | 'inventory-full' | 'too-heavy'): string {
   const messages: Record<typeof reason, string> = {
      'not-found': STALE_STASH_NOTE,
      'unknown-container': 'That chest is gone.',
      'inventory-full': `Your pack is full (${INVENTORY_STACK_LIMIT} entries) — drop or store something first.`,
      'too-heavy': 'You cannot carry that much more. Lighten your load first.',
   };
   return messages[reason];
}

// --- Helpers -----------------------------------------------------------------------

function containerOf(raw: string | undefined): StorageContainerId {
   return raw && isStorageContainerId(raw) ? raw : DEFAULT_CONTAINER;
}

function kindValue(raw: string | undefined): ItemKindId {
   return raw && raw in ITEM_KINDS ? raw as ItemKindId : ITEM_KIND_IDS[0];
}
