import { Schema, model, type Model } from 'mongoose';
import { RESOURCES, type ResourceKey } from '../../game/data/resources.js';
import { ATTRIBUTES, type AttributeKey } from '../../game/data/attributes.js';
import { SKILLS, type SkillKey } from '../../game/data/skills.js';
import { CURRENCIES, type CurrencyKey } from '../../game/data/currencies.js';
import { TRAITS, type TraitKey } from '../../game/data/traits.js';
import { STARTING_LOCATION } from '../../game/data/locations.js';
import { effectiveAttributes, emptyAllocation, type AttributeAllocation } from '../../game/character/attributes.js';
import type { ItemInstance } from '../../game/character/inventory.js';
import type { RaceId } from '../../game/data/races.js';

// A Character is the in-game entity (player-controlled OR NPC). Replaces the old
// Profile: stats/resources live here, keyed by its own uuid (an account can own
// several; NPCs have no account). See CLAUDE.md D12–D16.

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface ResourceState {
   current: number;
   max: number;
}

export interface SkillState {
   level: number;
   progress: number;
}

export interface CharacterIdentity {
   name: string;
   race: RaceId | null; // chosen during creation (Phase 6B)
   epithet: string; // e.g. 'Imperator', 'the Tavern Keep'
   gender: string; // picked from a list (male/female) on the creation panel
   bio: string; // a short description (shown in an embed field, so ≤ ~1024 chars)
   avatarUrl: string; // optional image URL, shown as an embed thumbnail ('' = none)
}

export interface CharacterDoc {
   _id: string; // uuid
   ownerId: string | null; // Account._id, or null for an NPC
   approvalStatus: ApprovalStatus;
   rejectionReason?: string;
   identity: CharacterIdentity;
   locationId: string; // → LocationId (resolved with a fallback at read time)
   resources: Record<ResourceKey, ResourceState>;
   // Action points have NO cap (D15): they accumulate via the hourly regen $inc.
   actionPoints: { current: number; totalEarned: number };
   // Effective attributes = racial base + creation allocation. Stored (not
   // derived on read) and recomputed by characterService whenever race or
   // allocation changes — checks/combat read this map directly.
   attributes: Record<AttributeKey, number>;
   // The creation point-buy (D25): how many of the CREATION_ATTRIBUTE_POINTS
   // landed on each attribute. Kept separate from `attributes` so a race change
   // mid-wizard rebases cleanly instead of corrupting the player's spend.
   attributeAllocation: AttributeAllocation;
   // Deed traits (courage, cowardice…), grown by choices in encounters. Rising
   // meters from 0; nothing gates on them yet (Phase 7).
   traits: Record<TraitKey, number>;
   // PLACEHOLDER pending the RPG ruleset (D14) — modelled, but no mechanics yet.
   skills: Record<SkillKey, SkillState>;
   // Currencies are per-character (D12).
   currencies: Record<CurrencyKey, number>;
   // Owned item instances (D28); static item data resolves from the catalog
   // (game/data/items.ts) by itemId at read time (D10). Bounded by
   // INVENTORY_STACK_LIMIT (enforced in inventoryService, free-tier friendly).
   inventory: ItemInstance[];
   // Worn/wielded gear: equipment slot id → inventory instanceId. Plain object
   // (not a catalog-derived field map) so ADDING a slot needs no migration.
   equipment: Partial<Record<string, string>>;
   createdAt: Date;
   updatedAt: Date;
}

// Schema field maps derived from the catalogs (single source of truth).
const fromKeys = <T>(keys: string[], value: T): Record<string, T> =>
   Object.fromEntries(keys.map((key) => [key, value]));

const itemInstanceSchema = new Schema({
   instanceId: { type: String, required: true },
   itemId: { type: String, required: true },
   quality: { type: String, required: true, default: 'common' },
   quantity: { type: Number, required: true, default: 1 },
   durability: { type: Number },
   acquiredAt: { type: Date, required: true },
}, { _id: false });

const characterSchema = new Schema({
   _id: { type: String, required: true },
   ownerId: { type: String, default: null, index: true },
   approvalStatus: { type: String, required: true, default: 'draft' },
   rejectionReason: { type: String },
   identity: {
      name: { type: String, required: true },
      race: { type: String, default: null },
      epithet: { type: String, default: '' },
      gender: { type: String, default: '' },
      bio: { type: String, default: '' },
      avatarUrl: { type: String, default: '' },
   },
   // Indexed: presence ("who is at the plaza?") is an indexed query over this
   // field — the single source of truth, never duplicated into location docs (D31).
   locationId: { type: String, required: true, default: STARTING_LOCATION, index: true },
   resources: fromKeys(Object.keys(RESOURCES), { current: { type: Number, required: true }, max: { type: Number, required: true } }),
   actionPoints: {
      current: { type: Number, required: true, default: 0 },
      totalEarned: { type: Number, required: true, default: 0 },
   },
   attributes: fromKeys(Object.keys(ATTRIBUTES), { type: Number, required: true }),
   attributeAllocation: fromKeys(Object.keys(ATTRIBUTES), { type: Number, required: true, default: 0 }),
   traits: fromKeys(Object.keys(TRAITS), { type: Number, required: true, default: 0 }),
   skills: fromKeys(Object.keys(SKILLS), { level: { type: Number, required: true }, progress: { type: Number, required: true } }),
   currencies: fromKeys(Object.keys(CURRENCIES), { type: Number, required: true }),
   inventory: { type: [itemInstanceSchema], default: [] },
   equipment: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false });

export const Character = model('Character', characterSchema) as unknown as Model<CharacterDoc>;

/** Catalog-derived stat block for a fresh character (identity/owner set by the caller).
 *  Attributes start at the racial base with an untouched allocation — the wizard's
 *  point-buy step (and any later race change) recomputes them via the service. */
export function defaultCharacterStats(race: RaceId | null = null): Pick<CharacterDoc, 'resources' | 'actionPoints' | 'attributes' | 'attributeAllocation' | 'traits' | 'skills' | 'currencies' | 'inventory' | 'equipment'> {
   return {
      resources: Object.fromEntries(
         Object.entries(RESOURCES).map(([key, def]) => [key, { current: def.defaultMax, max: def.defaultMax }]),
      ) as Record<ResourceKey, ResourceState>,
      actionPoints: { current: 0, totalEarned: 0 },
      attributes: effectiveAttributes(race, emptyAllocation()),
      attributeAllocation: emptyAllocation(),
      traits: Object.fromEntries(
         Object.keys(TRAITS).map((key) => [key, 0]),
      ) as Record<TraitKey, number>,
      skills: Object.fromEntries(
         Object.keys(SKILLS).map((key) => [key, { level: 1, progress: 0 }]),
      ) as Record<SkillKey, SkillState>,
      currencies: Object.fromEntries(
         Object.keys(CURRENCIES).map((key) => [key, 0]),
      ) as Record<CurrencyKey, number>,
      inventory: [],
      equipment: {},
   };
}
