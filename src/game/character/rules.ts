import type { CharacterDoc } from '../../db/models/character.js';
import { isIdentityComplete } from './identity.js';

export type ActBlockReason = 'not-approved' | 'incapacitated' | 'no-action-points';

export interface ActCheck {
   ok: boolean;
   reason?: ActBlockReason;
}

// How many characters one account may own. The owner's framing is "one character
// to start"; a small cap leaves room for alts without inviting abuse on the free
// tier. Tunable — it's the only place the limit lives.
export const MAX_CHARACTERS_PER_ACCOUNT = 3;

// Only a draft or rejected character can be edited/submitted. A pending one is
// awaiting the Imperator; an approved one is locked in (re-approval is future scope).
const EDITABLE_STATUSES: CharacterDoc['approvalStatus'][] = ['draft', 'rejected'];

export type SubmitBlockReason = 'not-editable' | 'incomplete';

export interface SubmitCheck {
   ok: boolean;
   reason?: SubmitBlockReason;
}

/** Whether the character's identity can still be changed (draft or rejected). Pure. */
export function canEdit(character: CharacterDoc): boolean {
   return EDITABLE_STATUSES.includes(character.approvalStatus);
}

/** Whether the character may be submitted for the Imperator's approval. Pure. */
export function canSubmit(character: CharacterDoc): SubmitCheck {
   if (!canEdit(character))
      return { ok: false, reason: 'not-editable' };

   if (!isIdentityComplete(character.identity))
      return { ok: false, reason: 'incomplete' };

   return { ok: true };
}

/**
 * Whether a character may perform a *character action* (serious combat, travel,
 * activities). Viewing (profile, inventory) does NOT use this gate. Pure — no DB.
 *
 * Rules (D13/D15): must be approved, must have health left, and must have enough
 * action points for the action's cost. A 0-HP character can be made active and
 * inspected, but cannot act.
 */
export function canCharacterAct(character: CharacterDoc, apCost = 0): ActCheck {
   if (character.approvalStatus !== 'approved')
      return { ok: false, reason: 'not-approved' };

   if (character.resources.health.current <= 0)
      return { ok: false, reason: 'incapacitated' };

   if (character.actionPoints.current < apCost)
      return { ok: false, reason: 'no-action-points' };

   return { ok: true };
}
