// Pure step logic for the 'obstacle' travel activity (D21/D22) — no Discord,
// no DB. An obstacle interrupts a travel move: the character attempts to get
// past it step by step; enough progress clears it (the move completes), too
// many setbacks force them back (the move fails). PLACEHOLDER mechanics:
// pure-random attempts, no stat reads, no damage — the D16 sparring precedent.
// The Phase 7 ruleset replaces the roll with real checks (and adds stakes).

export const OBSTACLE_PROGRESS_TO_CLEAR = 2;
export const OBSTACLE_SETBACKS_TO_FAIL = 3;
/** Chance one attempt succeeds. PLACEHOLDER — pure random until the ruleset (D14). */
export const OBSTACLE_SUCCESS_PERCENT = 55;

export interface ObstacleState {
   /** → EncounterId; resolved gracefully at read time (D10 rule 3). */
   encounterId: string;
   /** The interrupted move: stays at `fromId` unless the obstacle is cleared. */
   fromId: string;
   toId: string;
   progress: number;
   setbacks: number;
   /** Flavor of the latest attempt, rendered with the step (replay-safe: part of the state). */
   lastLine: string;
}

export type ObstacleOutcome = 'ongoing' | 'cleared' | 'forced-back';

/** Reads an ObstacleState back from the session's opaque `state` blob, tolerating
 *  missing/malformed fields (an old or hand-edited session must not crash the bot). */
export function obstacleStateFrom(blob: Record<string, unknown>): ObstacleState {
   const str = (v: unknown): string => (typeof v === 'string' ? v : '');
   const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

   return {
      encounterId: str(blob.encounterId),
      fromId: str(blob.fromId),
      toId: str(blob.toId),
      progress: num(blob.progress),
      setbacks: num(blob.setbacks),
      lastLine: str(blob.lastLine),
   };
}

export function initialObstacleState(encounterId: string, fromId: string, toId: string): ObstacleState {
   return { encounterId, fromId, toId, progress: 0, setbacks: 0, lastLine: '' };
}

/** One attempt at the obstacle. Pure: the caller rolls `success` (injectable in tests). */
export function attemptObstacle(state: ObstacleState, success: boolean, line: string): ObstacleState {
   return {
      ...state,
      progress: state.progress + (success ? 1 : 0),
      setbacks: state.setbacks + (success ? 0 : 1),
      lastLine: line,
   };
}

/** The outcome is DERIVED from state, so a crash between the final step-commit and
 *  the completion side effects is recoverable: re-entry sees a terminal state and
 *  offers to finish (see the obstacle component handler). */
export function obstacleOutcome(state: ObstacleState): ObstacleOutcome {
   if (state.progress >= OBSTACLE_PROGRESS_TO_CLEAR)
      return 'cleared';
   if (state.setbacks >= OBSTACLE_SETBACKS_TO_FAIL)
      return 'forced-back';
   return 'ongoing';
}
