import { randomUUID } from 'node:crypto';
import type { PipelineStage } from 'mongoose';
import { Character, defaultCharacterStats, type CharacterDoc, type CharacterIdentity } from '../models/character.js';
import { RESOURCES, type ResourceKey } from '../../game/data/resources.js';
import { STARTING_LOCATION } from '../../game/data/locations.js';
import type { CurrencyKey } from '../../game/data/currencies.js';
import type { RaceId } from '../../game/data/races.js';

export type ResourceDeltas = Partial<Record<ResourceKey, number>>;
export type CurrencyDeltas = Partial<Record<CurrencyKey, number>>;

// The identity fields a player may set/change (status/owner/location are managed
// by the service, not the player).
export type EditableIdentity = Partial<Pick<CharacterIdentity, 'name' | 'epithet' | 'gender' | 'bio' | 'avatarUrl'>>;
export type NewCharacterIdentity = EditableIdentity & { name: string; race?: RaceId | null };

// Same atomic aggregation-pipeline pattern as before (D6): every write clamps
// server-side in one round trip.
function setStage(fields: Record<string, unknown>): PipelineStage[] {
   return [{ $set: fields }];
}

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
         ...defaultCharacterStats(),
      };

      await Character.create(character);
      return (await this.get(character._id))!;
   },

   /** The auto-created first character handed to every new account (draft, unnamed-ish). */
   async createStarter(ownerId: string, name: string): Promise<CharacterDoc> {
      return this.create(ownerId, { name });
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

      return Character.findOneAndUpdate({ _id: characterId }, { $set: set }, { new: true }).lean<CharacterDoc>();
   },

   /** Sets the character's race (a separate step from the identity modal — modals can't host a select). */
   async setRace(characterId: string, race: RaceId): Promise<void> {
      await Character.updateOne({ _id: characterId }, { $set: { 'identity.race': race } });
   },

   /** draft|rejected → pending. Clears any prior rejection reason. */
   async submitForApproval(characterId: string): Promise<void> {
      await Character.updateOne(
         { _id: characterId },
         { $set: { approvalStatus: 'pending' }, $unset: { rejectionReason: '' } },
      );
   },

   /** pending → approved (the Imperator's verdict). Clears any prior rejection reason. */
   async approve(characterId: string): Promise<void> {
      await Character.updateOne(
         { _id: characterId },
         { $set: { approvalStatus: 'approved' }, $unset: { rejectionReason: '' } },
      );
   },

   /** pending → rejected, recording why (shown back to the player; editable + resubmittable). */
   async reject(characterId: string, reason: string): Promise<void> {
      await Character.updateOne(
         { _id: characterId },
         { $set: { approvalStatus: 'rejected', rejectionReason: reason } },
      );
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

      return Character.findOneAndUpdate({ _id: characterId }, setStage(fields), { new: true }).lean<CharacterDoc>();
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

      return Character.findOneAndUpdate({ _id: characterId }, setStage(fields), { new: true }).lean<CharacterDoc>();
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

   /** Bulk hourly regen for all characters except `excludeIds` (locked ones).
    *  Resources nudge toward max (placeholder flat amounts); AP just accumulates
    *  (no cap, D15). Returns the number of characters modified. */
   async regenAll(excludeIds: string[] = []): Promise<number> {
      const fields = regenFields();
      const filter = excludeIds.length > 0 ? { _id: { $nin: excludeIds } } : {};
      const result = await Character.updateMany(filter, setStage(fields));
      return result.modifiedCount;
   },

   /** Single-character regen — the deferred op for a character locked at regen time (D7). */
   async regen(characterId: string): Promise<void> {
      await Character.updateOne({ _id: characterId }, setStage(regenFields()));
   },
};

// One regen tick as a clamped $set map; shared by bulk + single paths so they
// can't drift. AP has no max, so it just grows.
function regenFields(): Record<string, unknown> {
   const fields: Record<string, unknown> = {
      'actionPoints.current': { $add: ['$actionPoints.current', AP_REGEN_PER_HOUR] },
      'actionPoints.totalEarned': { $add: ['$actionPoints.totalEarned', AP_REGEN_PER_HOUR] },
   };

   for (const [key, def] of Object.entries(RESOURCES)) {
      if (def.regenPerHour <= 0)
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
