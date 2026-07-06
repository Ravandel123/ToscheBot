// Pure step logic for the 'challenge' travel activity (D21/D22/D26) — no
// Discord, no DB. A challenge interrupts a travel move and exposes several
// APPROACHES (RPG/'s multi-approach model): each attempt resolves one option —
// usually a d100 roll-under check — and its outcome either completes the
// journey ('proceed'), ends it at the origin ('turn-back'), or keeps the
// challenge going ('retry'; failed retries accrue setbacks until the road
// wins). The terminal outcome is DERIVED-then-STORED in state (`resolution`),
// so a crash between the final step-commit and the completion side effects is
// recoverable (see the challenge component handler).
import type { ChallengeOption, ChallengeOutcome } from '../data/encounters.js';

export interface ChallengeState {
   /** → EncounterId; resolved gracefully at read time (D10 rule 3). */
   encounterId: string;
   /** The interrupted move: stays at `fromId` unless the challenge proceeds. */
   fromId: string;
   toId: string;
   setbacks: number;
   /** One-shot options already burned (their buttons disappear). */
   spentOptionIds: string[];
   /** Per-option d100 targets, computed from the actor when the session opens —
    *  so the stateless panel can show your % without re-reading the character. */
   optionTargets: Record<string, number>;
   /** Flavor + roll summary of the latest attempt (replay-safe: part of the state). */
   lastLine: string;
   /** '' while ongoing; set once, terminally, by the resolving attempt. */
   resolution: '' | 'proceed' | 'turn-back';
}

export type ChallengeProgress = 'ongoing' | 'proceed' | 'turn-back';

const FALLBACK_FAILURE: ChallengeOutcome = { result: 'retry', lines: ['It does not go as planned.'] };

/** Reads a ChallengeState back from the session's opaque `state` blob, tolerating
 *  missing/malformed fields (an old or hand-edited session must not crash the bot). */
export function challengeStateFrom(blob: Record<string, unknown>): ChallengeState {
   const str = (v: unknown): string => (typeof v === 'string' ? v : '');
   const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
   const resolution = blob.resolution === 'proceed' || blob.resolution === 'turn-back' ? blob.resolution : '';

   const targets: Record<string, number> = {};
   if (blob.optionTargets && typeof blob.optionTargets === 'object')
      for (const [key, value] of Object.entries(blob.optionTargets))
         if (typeof value === 'number' && Number.isFinite(value))
            targets[key] = value;

   return {
      encounterId: str(blob.encounterId),
      fromId: str(blob.fromId),
      toId: str(blob.toId),
      setbacks: num(blob.setbacks),
      spentOptionIds: Array.isArray(blob.spentOptionIds) ? blob.spentOptionIds.filter((id): id is string => typeof id === 'string') : [],
      optionTargets: targets,
      lastLine: str(blob.lastLine),
      resolution,
   };
}

export function initialChallengeState(
   encounterId: string,
   fromId: string,
   toId: string,
   optionTargets: Record<string, number>,
): ChallengeState {
   return { encounterId, fromId, toId, setbacks: 0, spentOptionIds: [], optionTargets, lastLine: '', resolution: '' };
}

/** Which outcome an attempted option lands on (checkless options always succeed). */
export function appliedOutcome(option: ChallengeOption, success: boolean): ChallengeOutcome {
   if (!option.check || success)
      return option.success;

   return option.failure ?? FALLBACK_FAILURE;
}

/** The options still on the table (one-shot approaches burn out when failed). */
export function availableOptions(options: readonly ChallengeOption[], state: ChallengeState): ChallengeOption[] {
   return options.filter((option) => !state.spentOptionIds.includes(option.id));
}

/**
 * One attempted approach. Pure: the caller rolls the check and picks the flavor
 * line (injectable in tests). A 'retry' after a FAILED check counts a setback;
 * reaching `maxSetbacks` resolves the challenge as 'turn-back' (the road wins).
 */
export function attemptChallenge(
   state: ChallengeState,
   option: ChallengeOption,
   success: boolean,
   line: string,
   maxSetbacks: number,
): ChallengeState {
   const outcome = appliedOutcome(option, success);
   const failed = !!option.check && !success;
   const setbacks = state.setbacks + (outcome.result === 'retry' && failed ? 1 : 0);
   const spentOptionIds = option.oneShot && failed ? [...state.spentOptionIds, option.id] : state.spentOptionIds;

   const resolution = outcome.result === 'retry'
      ? (setbacks >= maxSetbacks ? 'turn-back' as const : '')
      : outcome.result;

   return { ...state, setbacks, spentOptionIds, lastLine: line, resolution };
}

/** The progress is DERIVED from state — re-entry after a crash sees a terminal
 *  state and offers to finish the idempotent completion tail. */
export function challengeProgress(state: ChallengeState): ChallengeProgress {
   return state.resolution === '' ? 'ongoing' : state.resolution;
}
