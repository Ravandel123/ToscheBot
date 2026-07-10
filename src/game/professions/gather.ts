import { capitalize } from '../../lib/text.js';
import { randomInt, weightedItem } from '../../lib/random.js';
import { checkTarget, checkTrainingWeight, rollCheck, type CheckResult, type CheckSubject } from '../checks.js';
import { FORAGE_QUALITY_PREFIXES, foragableInfo, forageDescriptor, FORAGABLE_ITEMS, type ForagableItemId } from '../data/foragables.js';
import { LOCATIONS, resolveLocationId, type LocationDefinition } from '../data/locations.js';
import { RESOURCE_NODES, resourceNode, type GatherProfession, type ResourceNodeDefinition, type ResourceNodeId } from '../data/resourceNodes.js';
import { identifyCheck, pickDescriptor, rollMislabel } from './identify.js';
import type { ItemQualityId } from '../data/items.js';
import type { MysteryFields } from '../character/inventory.js';

// The generic gather resolver (R16, professions.md): one pure engine for every
// gathering profession — spend AP, roll the profession check vs the node,
// yield instances where QUANTITY scales with Success Levels and per-instance
// QUALITY comes from the check's surplus, then sweep the haul with one
// identify roll. Fishing (S2) reuses everything here except the identify
// sweep (a carp is a carp). A gather is a SHORT action (D5 rule 1) resolved
// in memory under the character lock — never an ActivitySession.
// 🟡 Every number is a balance placeholder (sim-checked, owner-unsigned).

/** AP one gather attempt costs, success or failure (the roll is the product). 🟡 */
export const FORAGE_AP_COST = 1;

/** Yield ceiling per gather — SLs past this stop adding units. 🟡 */
export const MAX_GATHER_YIELD = 4;

/**
 * Units one successful gather yields: 1 + one more per 2 SL, capped. A scraped
 * pass (SL 0) is a single find; a masterful sweep fills the basket. 🟡
 */
export function gatherQuantity(successLevels: number): number {
   return Math.min(1 + Math.floor(Math.max(0, successLevels) / 2), MAX_GATHER_YIELD);
}

/**
 * Per-instance quality from a check's surplus (the shared surplus→quality
 * model, skills.md — smithing reuses this when crafting lands): each unit
 * jitters −2..+1 around the Success Levels (skewed down — excellence needs
 * luck AND skill), banded into today's 4 tiers. Sim-verified (S1): fresh ≈
 * 15% poor / 75% common / 10% fine; masterwork ≈ 0% below ~50 effective, ~3%
 * at 76, ~15% at the 95 cap — the top tier stays special. Rolls internally —
 * call once PER UNIT so one sweep can mix tiers. 🟡 bands.
 */
export function qualityFromCheck(successLevels: number): ItemQualityId {
   const score = successLevels + randomInt(-2, 1);

   if (score <= -1)
      return 'poor';
   if (score <= 3)
      return 'common';
   if (score <= 7)
      return 'fine';
   return 'masterwork';
}

// --- Locating the node ------------------------------------------------------------

export interface LocatedResourceNode {
   id: ResourceNodeId;
   node: ResourceNodeDefinition;
}

/** The location's resource node for a profession, if it offers one. */
export function professionNodeAt(locationId: string, profession: GatherProfession): LocatedResourceNode | null {
   const location: LocationDefinition = LOCATIONS[resolveLocationId(locationId)];

   for (const id of location.resourceNodes ?? [])
      if (id in RESOURCE_NODES && resourceNode(id).profession === profession)
         return { id, node: resourceNode(id) };

   return null;
}

// --- The resolution ---------------------------------------------------------------

export interface GatherYield {
   itemId: ForagableItemId;
   quality: ItemQualityId;
   /** The identification veil — null when recognized on the spot. */
   mystery: MysteryFields | null;
}

export interface GatherResolution {
   check: CheckResult;
   /** One entry per yielded unit; empty on a failed check. */
   yields: GatherYield[];
   /** D40 weight for the gather path — the check rolled, win or lose. */
   gatherTrainingWeight: number;
   /** D40 weight for the identify path (one sweep over the haul); null when
    *  nothing was yielded (no identify was attempted). */
   identifyTrainingWeight: number | null;
}

/**
 * Resolves one gather attempt against a node. Rolls internally (mock
 * Math.random in tests). The identify sweep is ONE d100 roll compared against
 * each find's own identify target — a sharp-eyed day is sharp-eyed across the
 * whole basket, and one attempt credits one identify use (the house rule).
 * Identification outcomes deliberately carry no player-facing roll: every
 * label, right or wrong, must read equally confident (see identify.ts).
 */
export function resolveGather(subject: CheckSubject, node: ResourceNodeDefinition): GatherResolution {
   const check = rollCheck(subject, { node: node.skillNode, modifier: node.difficulty, raceAffinity: node.raceAffinity });
   const gatherTrainingWeight = checkTrainingWeight(check.target);

   if (!check.success)
      return { check, yields: [], gatherTrainingWeight, identifyTrainingWeight: null };

   const units = gatherQuantity(check.successLevels);
   const identifyRoll = randomInt(1, 100);
   const yields: GatherYield[] = [];
   let targetSum = 0;

   for (let i = 0; i < units; i++) {
      const itemId = weightedItem(node.table);
      const target = checkTarget(subject, identifyCheck(itemId));
      targetSum += target;

      let mystery: MysteryFields | null = null;
      if (identifyRoll > target) {
         const descriptorId = pickDescriptor(itemId);
         const apparentItemId = rollMislabel(itemId, descriptorId);
         mystery = { descriptorId, ...(apparentItemId ? { apparentItemId } : {}) };
      }

      yields.push({ itemId, quality: qualityFromCheck(check.successLevels), mystery });
   }

   return {
      check,
      yields,
      gatherTrainingWeight,
      identifyTrainingWeight: checkTrainingWeight(Math.round(targetSum / units)),
   };
}

// --- Turning yields into grants & narration -----------------------------------------

export interface GrantOrder {
   itemId: ForagableItemId;
   quality: ItemQualityId;
   quantity: number;
   mystery: MysteryFields | null;
}

/** Groups a haul into grant calls: recognized finds stack by (item, quality);
 *  every mystery stays its own instance (its veil is per-instance state). */
export function groupYields(yields: readonly GatherYield[]): GrantOrder[] {
   const orders: GrantOrder[] = [];

   for (const yielded of yields) {
      const mergeable = yielded.mystery === null
         ? orders.find((order) => order.mystery === null && order.itemId === yielded.itemId && order.quality === yielded.quality)
         : undefined;

      if (mergeable)
         mergeable.quantity += 1;
      else
         orders.push({ itemId: yielded.itemId, quality: yielded.quality, quantity: 1, mystery: yielded.mystery });
   }

   return orders;
}

/** What the FORAGER believes they picked up — perceived name for banners:
 *  'Pristine Silverleaf', 'Honeycap Mushroom' (a confident mislabel), or
 *  'An amber-capped mushroom' (an honest unknown). */
export function yieldDisplayName(order: Pick<GrantOrder, 'itemId' | 'quality' | 'mystery'>): string {
   if (order.mystery && !order.mystery.apparentItemId) {
      const descriptor = forageDescriptor(order.mystery.descriptorId);
      return capitalize(descriptor?.text ?? 'an unidentified find');
   }

   const perceivedId = (order.mystery?.apparentItemId ?? order.itemId) as ForagableItemId;
   const prefix = FORAGE_QUALITY_PREFIXES[order.quality];
   const name = FORAGABLE_ITEMS[perceivedId].name;
   return prefix ? `${prefix} ${name}` : name;
}

/** The finds worth a chronicle line (D24): recognized on the spot AND either a
 *  noteworthy species or a pristine specimen. An unidentified rarity stays
 *  quiet — nobody, including the finder, knows what was found yet. */
export function noteworthyYields(yields: readonly GatherYield[]): GatherYield[] {
   return yields.filter((yielded) =>
      yielded.mystery === null && (foragableInfo(yielded.itemId)?.noteworthy === true || yielded.quality === 'masterwork'));
}
