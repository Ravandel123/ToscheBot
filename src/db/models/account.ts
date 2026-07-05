import { Schema, model, type Model } from 'mongoose';

// One per Discord user: the "human". Owns characters and points at the one
// currently being controlled. Keyed by Discord user id. (See CLAUDE.md D12.)
// Account-level SETTINGS live here too (D27): they describe the player, not a
// character, so they survive switching/rerolling characters.

// How measurements (weight/height/temperature) are SHOWN to this player (R19).
// The database always stores metric; imperial is computed on the fly at display
// time — one canonical stored unit, per-player presentation.
export type UnitSystem = 'metric' | 'imperial';

// Account settings are SERVER-WIDE, not game-only (R19): they describe the
// player, so they survive switching/rerolling characters and affect normal
// server use too (units, timezone).
export interface AccountSettings {
   // Master opt-out for random/ambient game events targeting this player (the
   // ambient-events system from the backlog checks it; nothing else consumes it
   // yet). Defaults ON — a verified character means you're playing.
   activeGame: boolean;
   // Whether the bot may DM this player (approval verdicts, future pings).
   dmNotifications: boolean;
   // Display unit system (R19). Stored metric always; imperial is a view.
   units: UnitSystem;
   // The player's country — server flavour/roleplay (and a sensible default
   // timezone). Free text; null until set.
   country: string | null;
   // IANA timezone (e.g. 'Europe/Warsaw'). Affects server + game time features,
   // not only the game (R19). Validated on set; null until then.
   timezone: string | null;
}

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
   activeGame: true,
   dmNotifications: true,
   units: 'metric',
   country: null,
   timezone: null,
};

// The boolean subset of settings — the ones the `/profile` panel renders as
// simple ON/OFF toggles. Non-boolean settings (units/country/timezone) get their
// own controls. Kept as a typed tuple so adding a boolean setting is one edit.
export const BOOLEAN_SETTING_KEYS = ['activeGame', 'dmNotifications'] as const;
export type BooleanSettingKey = (typeof BOOLEAN_SETTING_KEYS)[number];

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
      units: { type: String, required: true, default: DEFAULT_ACCOUNT_SETTINGS.units },
      country: { type: String, default: DEFAULT_ACCOUNT_SETTINGS.country },
      timezone: { type: String, default: DEFAULT_ACCOUNT_SETTINGS.timezone },
   },
}, { timestamps: true, minimize: false });

export const Account = model('Account', accountSchema) as unknown as Model<AccountDoc>;

/** Settings with defaults filled in — accounts created before D27 lack the subdoc. */
export function accountSettings(account: Pick<AccountDoc, 'settings'> | null): AccountSettings {
   return { ...DEFAULT_ACCOUNT_SETTINGS, ...account?.settings };
}
