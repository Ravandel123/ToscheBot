import { characterService, type EditableIdentity } from '../db/services/characterService.js';
import { inventoryService } from '../db/services/inventoryService.js';
import { DEFAULT_ITEM_QUALITY } from '../game/data/items.js';
import { NPCS, npcCharacterId, type NpcDefinition } from '../game/data/npcs.js';

// The NPC seed's pure core (D44), split from the CLI (seed-npcs.ts) exactly
// like seed.ts is from seed-characters.ts: no `config` import, so it runs
// against the in-memory test DB. Idempotent update-by-npcId (AUDIT §3.3):
// the roster catalog owns each NPC's STATIC half and a rerun refreshes it;
// everything the world can mutate is the NPC's own state and is never reset.

export type NpcSeedOutcome = 'created' | 'unchanged' | 'updated';

/**
 * Upserts ONE roster entry through the normal domain services (never a raw
 * model write). CREATE mints the approved ownerless character at its home and
 * grants starting inventory/coins; a grant that cannot land (unknown id,
 * over carry capacity) throws — that's a roster typo the owner must see.
 * UPDATE refreshes only the static half: identity, race (rebasing attributes
 * via the same path a player race-change uses) and home. Mutable NPC state
 * (pack, coins, resources, progression) is deliberately untouched.
 */
export async function applyNpc(npcId: string, definition: NpcDefinition): Promise<NpcSeedOutcome> {
   const characterId = npcCharacterId(npcId);
   const existing = await characterService.get(characterId);

   if (!existing) {
      await characterService.createNpc(characterId, {
         name: definition.name,
         race: definition.race,
         epithet: definition.epithet,
         gender: definition.gender,
         bio: definition.bio,
      }, definition.homeLocationId);

      for (const grant of definition.startingInventory ?? []) {
         const result = await inventoryService.grantItems(characterId, grant.itemId, grant.quality ?? DEFAULT_ITEM_QUALITY, grant.quantity ?? 1);
         if (!result.ok)
            throw new Error(`could not grant '${grant.itemId}' to NPC '${npcId}': ${result.reason}`);
      }

      if (definition.startingCoins)
         await characterService.applyCurrencyDeltas(characterId, { deltradaCoins: definition.startingCoins });

      return 'created';
   }

   let changed = false;

   const identityChanges: EditableIdentity = {};
   if (existing.identity.name !== definition.name)
      identityChanges.name = definition.name;
   if (existing.identity.epithet !== definition.epithet)
      identityChanges.epithet = definition.epithet;
   if (existing.identity.gender !== definition.gender)
      identityChanges.gender = definition.gender;
   if (existing.identity.bio !== definition.bio)
      identityChanges.bio = definition.bio;

   if (Object.keys(identityChanges).length > 0) {
      await characterService.updateIdentity(characterId, identityChanges);
      changed = true;
   }

   if (existing.identity.race !== definition.race) {
      await characterService.setRace(characterId, definition.race);
      changed = true;
   }

   // Today NOTHING moves an NPC (no npc-tick cron yet), so the catalog is
   // authoritative for position too: re-homing an NPC in the roster repositions
   // it on reseed. The day the cron lands, drift must win — DELETE this block
   // (location becomes mutable state, same rule as the pack).
   if (existing.locationId !== definition.homeLocationId) {
      await characterService.setLocation(characterId, definition.homeLocationId);
      changed = true;
   }

   return changed ? 'updated' : 'unchanged';
}

export interface NpcSeedReport {
   created: number;
   updated: number;
   unchanged: number;
   /** Per-NPC outcome lines (in roster order) for the CLI to print. */
   lines: string[];
}

const OUTCOME_MARKS: Record<NpcSeedOutcome, string> = {
   created: '✔ created',
   updated: '↻ updated',
   unchanged: '= unchanged',
};

/** Upserts every roster entry in order, collecting a printable report.
 *  Assumes the DB is connected. */
export async function runNpcSeed(roster: Readonly<Record<string, NpcDefinition>> = NPCS): Promise<NpcSeedReport> {
   const report: NpcSeedReport = { created: 0, updated: 0, unchanged: 0, lines: [] };

   for (const [npcId, definition] of Object.entries(roster)) {
      const outcome = await applyNpc(npcId, definition);
      report[outcome]++;
      report.lines.push(`${OUTCOME_MARKS[outcome]} '${definition.name}, ${definition.epithet}' (${npcId}) at ${definition.homeLocationId}`);
   }

   return report;
}
