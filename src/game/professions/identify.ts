import { chance, randomItem, randomInt } from '../../lib/random.js';
import { identificationOf, type ItemInstance } from '../character/inventory.js';
import { checkTarget, type CheckDefinition, type CheckSubject } from '../checks.js';
import { FORAGABLES, FORAGABLE_ITEM_IDS, foragableInfo, isForagableId, type ForagableItemId } from '../data/foragables.js';

// Identification & the misidentification gamble (R16, professions.md). Pure —
// no Discord, no DB. The one rule that shapes everything here: the bot never
// reveals whether an identification was RIGHT. Every outcome reads confident
// ("Ah — of course. Honeycap."), so a wrong label is indistinguishable from a
// true one until the truth surfaces — that ambiguity IS the mechanic. Callers
// must not leak it either (no roll results, no differing AP charges).

/** AP to Examine a find on its `/inventory` card. Charged UNIFORMLY — even a
 *  re-check of something already known — so the cost itself can't leak which
 *  labels are settled. 🟡 */
export const EXAMINE_AP_COST = 1;

/** Chance that a FAILED identify confidently mislabels instead of admitting
 *  ignorance (the gamble; the rest stays an honest mystery). 🟡 */
export const MISLABEL_CHANCE_PERCENT = 40;

/** The d100 check an identify attempt rolls: the Identify leaf (trains the
 *  whole Foraging path, D40) shifted by how recognizable this item is. */
export function identifyCheck(itemId: ForagableItemId): CheckDefinition {
   return { node: 'identify_forage', modifier: FORAGABLES[itemId].identifyModifier };
}

/** A random look for a freshly gathered, unrecognized find. */
export function pickDescriptor(itemId: ForagableItemId): string {
   return randomItem(FORAGABLES[itemId].looks);
}

/**
 * The plausible wrong id a failed identify settles on: same family, sharing
 * the shown look where possible (an ashgill passing for a honeycap), never
 * the item itself. Null when the family offers no impostor — then the find
 * simply stays unidentified (a mislabel must always be plausible, R16).
 */
export function plausibleMislabel(itemId: ForagableItemId, descriptorId: string): ForagableItemId | null {
   const family = FORAGABLES[itemId].family;
   const kin = FORAGABLE_ITEM_IDS.filter((id) => id !== itemId && FORAGABLES[id].family === family);
   if (kin.length === 0)
      return null;

   const lookalikes = kin.filter((id) => (FORAGABLES[id].looks as readonly string[]).includes(descriptorId));
   return randomItem(lookalikes.length > 0 ? lookalikes : kin);
}

/** Rolls the mislabel gamble for one failed identify: a confident wrong id,
 *  or null (the find stays an honest unknown). */
export function rollMislabel(itemId: ForagableItemId, descriptorId: string): ForagableItemId | null {
   if (!chance(MISLABEL_CHANCE_PERCENT))
      return null;

   return plausibleMislabel(itemId, descriptorId);
}

// --- The Examine action (the /inventory card re-check) ---------------------------

export type ExamineResult =
   /** Already truly known — no roll, nothing trains, but the AP was spent. */
   | { kind: 'confirmed' }
   /** The roll succeeded: the true identity is (or stays) certain. */
   | { kind: 'revealed'; target: number }
   /** Failed on an unknown — and confidently settled on the wrong answer. */
   | { kind: 'fooled'; apparentItemId: ForagableItemId; target: number }
   /** Failed on a mislabel — the wrong belief survives another look. */
   | { kind: 'unshaken'; target: number }
   /** Failed on an unknown and admits it — still a mystery. */
   | { kind: 'stumped'; target: number }
   /** Not a foragable at all (stale customId) — nothing to examine. */
   | { kind: 'not-examinable' };

/**
 * Resolves one Examine of an owned instance. Rolls internally (mock
 * Math.random in tests). Truth is sticky: an `identified: true` instance can
 * only be confirmed, never talked back into doubt. `target` is exposed so the
 * caller can credit the rolled attempt (checkTrainingWeight, D40) — a
 * 'confirmed' shortcut rolled nothing and must credit nothing.
 */
export function examineInstance(subject: CheckSubject, instance: ItemInstance): ExamineResult {
   if (!isForagableId(instance.itemId) || !foragableInfo(instance.itemId))
      return { kind: 'not-examinable' };

   const state = identificationOf(instance);
   if (state === 'identified')
      return { kind: 'confirmed' };

   const target = checkTarget(subject, identifyCheck(instance.itemId));
   if (randomInt(1, 100) <= target)
      return { kind: 'revealed', target };

   if (state === 'mislabeled')
      return { kind: 'unshaken', target };

   const apparentItemId = rollMislabel(instance.itemId, instance.descriptorId ?? '');
   return apparentItemId ? { kind: 'fooled', apparentItemId, target } : { kind: 'stumped', target };
}
