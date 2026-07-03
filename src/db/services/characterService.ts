import { randomUUID } from 'node:crypto';
import type { PipelineStage } from 'mongoose';
import { Character, defaultCharacterStats, type CharacterDoc, type CharacterIdentity } from '../models/character.js';
import { activitySessionService } from './activitySessionService.js';
import { RESOURCES, type ResourceKey } from '../../game/data/resources.js';
import { STARTING_LOCATION } from '../../game/data/locations.js';
import { baseAttributes, effectiveAttributes, type AttributeAllocation } from '../../game/character/attributes.js';
import { ATTRIBUTE_KEYS } from '../../game/data/attributes.js';
import type { CurrencyKey } from '../../game/data/currencies.js';
import type { TraitKey } from '../../game/data/traits.js';
import type { RaceId } from '../../game/data/races.js';

export type ResourceDeltas = Partial<Record<ResourceKey, number>>;
export type CurrencyDeltas = Partial<Record<CurrencyKey, number>>;
export type TraitDeltas = Partial<Record<TraitKey, number>>;

// The identity fields a player may set/change (status/owner/location are managed
// by the service, not the player).
export type EditableIdentity = Partial<Pick<CharacterIdentity, 'name' | 'epithet' | 'gender' | 'bio' | 'avatarUrl'>>;
export type NewCharacterIdentity = EditableIdentity & { name: string; race?: RaceId | null };

// Same atomic aggregation-pipeline pattern as before (D6): every write clamps
// server-side in one round trip. Mongoose 9 only accepts a pipeline array when
// the call opts in — every consumer must pass PIPELINE in its options.
function setStage(fields: Record<string, unknown>): PipelineStage[] {
   return [{ $set: fields }];
}

const PIPELINE = { updatePipeline: true } as const;

export const characterService = {
   async get(characterId: string): Promise<CharacterDoc | null> {
      return Character.findById(characterId).lean<CharacterDoc>();
   },

   async getOwned(ownerId: string): Promise<CharacterDoc[]> {
      return Character.find({ ownerId }).lean<CharacterDoc[]>();
   },

   /** How many characters an account owns (for the per-account cap). */
   async countOwned(ownerId: string): Promise<number> {
      return Character.countDocuments({ ownerId });
   },

   /** Creates a fresh, unapproved (draft) character owned by `ownerId`. */
   async create(ownerId: string, identity: NewCharacterIdentity): Promise<CharacterDoc> {
      const character = {
         _id: randomUUID(),
         ownerId,
         approvalStatus: 'draft' as const,
         identity: {
            name: identity.name,
            race: identity.race ?? null,
            epithet: identity.epithet ?? '',
            gender: identity.gender ?? '',
            bio: identity.bio ?? '',
            avatarUrl: identity.avatarUrl ?? '',
         },
         locationId: STARTING_LOCATION,
         ...defaultCharacterStats(identity.race ?? null),
      };

      const created = await Character.create(character);
      return created.toObject();
   },

   /** Updates editable identity fields. Callers gate with `canEdit` first. */
   async updateIdentity(characterId: string, identity: EditableIdentity): Promise<CharacterDoc | null> {
      const set: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(identity)) {
         if (value !== undefined)
            set[`identity.${key}`] = value;
      }

      if (Object.keys(set).length === 0)
         return this.get(characterId);

      return Character.findOneAndUpdate({ _id: characterId }, { $set: set }, { returnDocument: 'after' }).lean<CharacterDoc>();
   },

   /** Sets the character's race and rebases effective attributes on the new
    *  racial base in the same atomic write (allocation is preserved — the
    *  pipeline reads it from the doc itself). */
   async setRace(characterId: string, race: RaceId): Promise<void> {
      const base = baseAttributes(race);
      const fields: Record<string, unknown> = { 'identity.race': race };

      for (const key of ATTRIBUTE_KEYS)
         fields[`attributes.${key}`] = { $add: [base[key], { $ifNull: [`$attributeAllocation.${key}`, 0] }] };

      await Character.updateOne({ _id: characterId }, setStage(fields), PIPELINE);
   },

   /** Persists a creation point-buy state (validated by the caller via
    *  game/character/attributes.ts) and the effective attributes it implies. */
   async setAttributeAllocation(characterId: string, race: RaceId | null, allocation: AttributeAllocation): Promise<void> {
      await Character.updateOne(
         { _id: characterId },
         { $set: { attributeAllocation: allocation, attributes: effectiveAttributes(race, allocation) } },
      );
   },

   /** Adds signed deed-trait deltas, clamping each to >= 0 atomically. */
   async applyTraitDeltas(characterId: string, deltas: TraitDeltas): Promise<void> {
      const fields: Record<string, unknown> = {};

      for (const [key, delta] of Object.entries(deltas)) {
         if (!delta)
            continue;

         fields[`traits.${key}`] = { $max: [0, { $add: [{ $ifNull: [`$traits.${key}`, 0] }, delta] }] };
      }

      if (Object.keys(fields).length === 0)
         return;

      await Character.updateOne({ _id: characterId }, setStage(fields), PIPELINE);
   },

   // The three status transitions are guarded on the CURRENT status (not just
   // the id): a decree message's buttons can outlive the verdict, and a stale
   // Approve click must not bless a character that was since rejected/edited.
   // Each returns false when the guard failed — the transition did not happen.

   /** draft|rejected → pending. Clears any prior rejection reason. */
   async submitForApproval(characterId: string): Promise<boolean> {
      const result = await Character.updateOne(
         { _id: characterId, approvalStatus: { $in: ['draft', 'rejected'] } },
         { $set: { approvalStatus: 'pending' }, $unset: { rejectionReason: '' } },
      );
      return result.modifiedCount > 0;
   },

   /** pending → approved (the Imperator's verdict). Clears any prior rejection reason. */
   async approve(characterId: string): Promise<boolean> {
      const result = await Character.updateOne(
         { _id: characterId, approvalStatus: 'pending' },
         { $set: { approvalStatus: 'approved' }, $unset: { rejectionReason: '' } },
      );
      return result.modifiedCount > 0;
   },

   /** pending → rejected, recording why (shown back to the player; editable + resubmittable). */
   async reject(characterId: string, reason: string): Promise<boolean> {
      const result = await Character.updateOne(
         { _id: characterId, approvalStatus: 'pending' },
         { $set: { approvalStatus: 'rejected', rejectionReason: reason } },
      );
      return result.modifiedCount > 0;
   },

   /** Adjusts resources, clamping each to [0, max] atomically. */
   async applyResourceDeltas(characterId: string, deltas: ResourceDeltas): Promise<CharacterDoc | null> {
      const fields: Record<string, unknown> = {};

      for (const [key, delta] of Object.entries(deltas)) {
         if (!delta)
            continue;

         fields[`resources.${key}.current`] = {
            $max: [0, { $min: [`$resources.${key}.max`, { $add: [`$resources.${key}.current`, delta] }] }],
         };
      }

      if (Object.keys(fields).length === 0)
         return this.get(characterId);

      return Character.findOneAndUpdate({ _id: characterId }, setStage(fields), { returnDocument: 'after', ...PIPELINE }).lean<CharacterDoc>();
   },

   /** Adds signed currency deltas, clamping each to >= 0 atomically. */
   async applyCurrencyDeltas(characterId: string, deltas: CurrencyDeltas): Promise<CharacterDoc | null> {
      const fields: Record<string, unknown> = {};

      for (const [key, delta] of Object.entries(deltas)) {
         if (!delta)
            continue;

         fields[`currencies.${key}`] = { $max: [0, { $add: [`$currencies.${key}`, delta] }] };
      }

      if (Object.keys(fields).length === 0)
         return this.get(characterId);

      return Character.findOneAndUpdate({ _id: characterId }, setStage(fields), { returnDocument: 'after', ...PIPELINE }).lean<CharacterDoc>();
   },

   /**
    * Atomically spends `cost` action points. Returns true if spent, false if the
    * character couldn't afford it (the filter only matches when current >= cost,
    * so concurrent spends can't overdraw). The single gate all AP-costing
    * actions go through.
    */
   async spendActionPoints(characterId: string, cost: number): Promise<boolean> {
      if (cost <= 0)
         return true;

      const result = await Character.updateOne(
         { _id: characterId, 'actionPoints.current': { $gte: cost } },
         { $inc: { 'actionPoints.current': -cost } },
      );

      return result.modifiedCount > 0;
   },

   async setLocation(characterId: string, locationId: string): Promise<void> {
      await Character.updateOne({ _id: characterId }, { $set: { locationId } });
   },

   /** Bulk hourly regen for all characters except `excludeIds` (locked or
    *  mid-activity). Resources nudge toward max (placeholder flat amounts); AP
    *  just accumulates (no cap, D15). Returns the number of characters modified. */
   async regenAll(excludeIds: string[] = []): Promise<number> {
      const fields = regenFields('full');
      const filter = excludeIds.length > 0 ? { _id: { $nin: excludeIds } } : {};
      const result = await Character.updateMany(filter, setStage(fields), PIPELINE);
      return result.modifiedCount;
   },

   /** Bulk hourly regen for characters busy in a durable activity (D23): AP
    *  always accrues, but vitals not flagged `regenWhileBusy` pause (skipped,
    *  not deferred — you don't heal mid-climb). Safe without a lock: every
    *  field it touches is only ever written via atomic deltas. */
   async regenAllBusy(ids: string[]): Promise<number> {
      if (ids.length === 0)
         return 0;

      const result = await Character.updateMany({ _id: { $in: ids } }, setStage(regenFields('busy')), PIPELINE);
      return result.modifiedCount;
   },

   /** Single-character regen — the deferred op for a character locked at regen
    *  time (D7). Decides full-vs-busy at EXECUTION time: the op lands after the
    *  in-memory lock releases, but a durable session may still be running. */
   async regen(characterId: string): Promise<void> {
      const session = await activitySessionService.getActiveForParticipant(characterId);
      await Character.updateOne({ _id: characterId }, setStage(regenFields(session ? 'busy' : 'full')), PIPELINE);
   },
};

export type RegenScope = 'full' | 'busy';

// One regen tick as a clamped $set map; shared by bulk + single paths so they
// can't drift. AP has no max, so it just grows — and it grows in BOTH scopes
// (D15/D23); the 'busy' scope skips resources that pause mid-activity.
// Exported for tests only (pure).
export function regenFields(scope: RegenScope): Record<string, unknown> {
   const fields: Record<string, unknown> = {
      'actionPoints.current': { $add: ['$actionPoints.current', AP_REGEN_PER_HOUR] },
      'actionPoints.totalEarned': { $add: ['$actionPoints.totalEarned', AP_REGEN_PER_HOUR] },
   };

   for (const [key, def] of Object.entries(RESOURCES)) {
      if (def.regenPerHour <= 0)
         continue;
      if (scope === 'busy' && !def.regenWhileBusy)
         continue;

      fields[`resources.${key}.current`] = {
         $min: [`$resources.${key}.max`, { $add: [`$resources.${key}.current`, def.regenPerHour] }],
      };
   }

   return fields;
}

// PLACEHOLDER (D14): flat regen. The RPG ruleset may later derive this per
// character (e.g. from toughness) — doable in the same pipeline from the doc's
// own fields, so the bulk write stays one round trip.
const AP_REGEN_PER_HOUR = 1;
