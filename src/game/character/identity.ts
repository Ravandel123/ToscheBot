import type { ApprovalStatus, CharacterDoc, CharacterIdentity } from '../../db/models/character.js';

// Pure identity helpers — no Discord, no DB. The field limits are shared by the
// creation/edit modal (Discord input `maxLength`) and submit-time validation so
// the two can never drift.

/** Human label (with emoji) for each approval state. Plain strings — no discord.js. */
export const STATUS_LABEL: Record<ApprovalStatus, string> = {
   draft: '📝 Draft',
   pending: '⏳ Pending approval',
   approved: '✅ Approved',
   rejected: '❌ Rejected',
};

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 32;
export const EPITHET_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 1000; // a short description; must stay ≤ 1024 to fit an embed field
export const AVATAR_URL_MAX_LENGTH = 400;

// Gender is a fixed pick (a select on the panel), not free text. Add options here
// if the world ever needs more — it's a one-line change the select reads from.
export const GENDER_CHOICES = [
   { label: 'Male', value: 'male' },
   { label: 'Female', value: 'female' },
] as const;

/** A usable http(s) image link (we only ever hand it to Discord as a thumbnail; no server-side fetch). */
export function isHttpUrl(value: string | undefined): value is string {
   return !!value && /^https?:\/\/\S+$/i.test(value);
}

/** "Name, Epithet" when an epithet is set, otherwise just the name. */
export function displayName(character: Pick<CharacterDoc, 'identity'>): string {
   const { name, epithet } = character.identity;
   return epithet ? `${name}, ${epithet}` : name;
}

/**
 * Whether a character is complete enough to be *submitted* for approval: at
 * least a real name and a chosen race. The owner does the real vetting at the
 * approval step (D13) — this just blocks empty/placeholder submissions.
 */
export function isIdentityComplete(identity: CharacterIdentity): boolean {
   return identity.name.trim().length >= NAME_MIN_LENGTH && identity.race !== null;
}
