// The way OUT of a durable activity. Solo sessions never expire, so every
// step must offer one — and it is never a generic "Cancel": each activity
// authors its own in-character exit (the climber lets go and drops, the talker
// insults the other side and the talk is cut off, the fighter yields).
// An exit must never be a better deal than the activity's worst choice.
import type { TraitKey } from '../data/traits.js';

export interface ActivityExit {
   /** Button label — what the character DOES, not "Cancel". */
   label: string;
   emoji: string;
   /** One is shown when the character takes the exit. */
   lines: readonly [string, ...string[]];
   /** Deed-trait deltas walking away inflicts. */
   traits?: Partial<Record<TraitKey, number>>;
}
