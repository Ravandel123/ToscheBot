import { Schema, model, type Model } from 'mongoose';

// The stash (D33): owned-but-not-carried items, ONE document per instance/stack.
// The carried pack stays embedded on the character (Character.inventory[]) because
// it feeds hot-path challenge checks and every equip/use/drop is a single-doc
// atomic write. Owned/stored items are UNBOUNDED (a hoard can reach thousands —
// D32), so embedding them would tax every character read and make sorting/paging
// expensive; a row-per-item collection lets a browse fetch a PAGE (~10 docs)
// instead of the whole hoard. A normal character read never touches this
// collection; only `/stash` and the transfer paths do.
//
// Identity note (diverges from D33's literal "_id = instanceId"): the pack's
// `instanceId` is only 8 hex and only unique WITHIN one character's pack, so it
// is unsafe as a GLOBAL _id (two characters could collide, and a full uuid _id
// would overflow the 100-char customId budget beside the character id). Instead
// `_id` is a fresh uuid (global doc identity) and `instanceId` is a short handle
// re-minted unique within the owner's stash, so it can ride customIds and resolve
// a doc via { ownerId, container, instanceId }.

export interface ItemDoc {
   _id: string; // uuid — global document identity
   ownerId: string; // → Character._id; indexed with `container`
   container: string; // → StorageContainerId (home_chest, …); resolved with a fallback
   /** Short handle unique within the owner's stash — rides in customIds. */
   instanceId: string;
   itemId: string; // → game/data/items.ts catalog (D10), tolerant of stale ids
   quality: string; // → ItemQualityId (per-instance craftsmanship, D28)
   quantity: number; // > 1 only for stackable kinds; a whole stack is one doc
   durability?: number; // equippable kinds only
   acquiredAt: Date; // preserved across pack ↔ stash transfers
   createdAt: Date;
   updatedAt: Date;
}

const itemSchema = new Schema({
   _id: { type: String, required: true },
   ownerId: { type: String, required: true },
   container: { type: String, required: true },
   instanceId: { type: String, required: true },
   itemId: { type: String, required: true },
   quality: { type: String, required: true, default: 'common' },
   quantity: { type: Number, required: true, default: 1 },
   durability: { type: Number },
   acquiredAt: { type: Date, required: true },
}, { timestamps: true, minimize: false });

// Every stash read is scoped to one owner's one container; this compound index
// backs both the paginated category `find` and the counts aggregation (D33).
itemSchema.index({ ownerId: 1, container: 1 });

export const Item = model('Item', itemSchema) as unknown as Model<ItemDoc>;
