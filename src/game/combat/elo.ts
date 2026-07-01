export const DEFAULT_ELO = 1000;
const K_FACTOR = 32;

/** Probability (0–1) that `rating` beats `opponentRating` under the Elo model. */
export function expectedScore(rating: number, opponentRating: number): number {
   return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

/**
 * Rating points the player gains/loses. `score` is 1 for a win, 0 for a loss,
 * 0.5 for a draw. Winner gains `eloChange(...)`, loser loses the same amount.
 */
export function eloChange(rating: number, opponentRating: number, score: number, k = K_FACTOR): number {
   return Math.round(k * (score - expectedScore(rating, opponentRating)));
}
