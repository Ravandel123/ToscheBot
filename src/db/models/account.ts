import { Schema, model, type Model } from 'mongoose';

// One per Discord user: the "human". Owns characters and points at the one
// currently being controlled. Keyed by Discord user id. (See CLAUDE.md D12.)
export interface AccountDoc {
   _id: string; // Discord user id
   username: string;
   activeCharacterId: string | null; // → Character._id
   createdAt: Date;
   updatedAt: Date;
}

const accountSchema = new Schema({
   _id: { type: String, required: true },
   username: { type: String, required: true },
   activeCharacterId: { type: String, default: null },
}, { timestamps: true });

export const Account = model('Account', accountSchema) as unknown as Model<AccountDoc>;
