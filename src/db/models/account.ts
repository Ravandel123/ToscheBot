import { Schema, model, type Model } from 'mongoose';

// One per Discord user: the "human". Owns characters and points at the one
// currently being controlled. Keyed by Discord user id. (See CLAUDE.md D12.)
// Account-level SETTINGS live here too (D27): they describe the player, not a
// character, so they survive switching/rerolling characters.

export interface AccountSettings {
   // Master opt-out for random/ambient game events targeting this player (the
   // ambient-events system from the backlog checks it; nothing else consumes it
   // yet). Defaults ON — a verified character means you're playing.
   activeGame: boolean;
   // Whether the bot may DM this player (approval verdicts, future pings).
   dmNotifications: boolean;
}

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
   activeGame: true,
   dmNotifications: true,
};

export interface AccountDoc {
   _id: string; // Discord user id
   username: string;
   activeCharacterId: string | null; // → Character._id
   settings: AccountSettings;
   createdAt: Date;
   updatedAt: Date;
}

const accountSchema = new Schema({
   _id: { type: String, required: true },
   username: { type: String, required: true },
   activeCharacterId: { type: String, default: null },
   settings: {
      activeGame: { type: Boolean, required: true, default: DEFAULT_ACCOUNT_SETTINGS.activeGame },
      dmNotifications: { type: Boolean, required: true, default: DEFAULT_ACCOUNT_SETTINGS.dmNotifications },
   },
}, { timestamps: true, minimize: false });

export const Account = model('Account', accountSchema) as unknown as Model<AccountDoc>;

/** Settings with defaults filled in — accounts created before D27 lack the subdoc. */
export function accountSettings(account: Pick<AccountDoc, 'settings'> | null): AccountSettings {
   return { ...DEFAULT_ACCOUNT_SETTINGS, ...account?.settings };
}
