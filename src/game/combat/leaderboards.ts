import { LADDER_LENGTH } from './spireLadder.js';
import type { SmackdownRecordDoc } from '../../db/models/smackdownRecord.js';

// Leaderboard categories: each is a way to rank and render the one record set.
// Adding a board = a catalog entry (+ a record field if it needs new data).

export interface LeaderboardCategory {
   name: string;
   emoji: string;
   /** The numeric SmackdownRecord field ranked (descending). */
   sortField: 'duelWins' | 'trialRung';
   /** One row's stat text after the fighter's name. */
   format(record: SmackdownRecordDoc): string;
}

export const LEADERBOARD_CATEGORIES = {
   duels: {
      name: 'Duelists',
      emoji: '⚔️',
      sortField: 'duelWins',
      format: (record) => `**${record.duelWins ?? 0}** won · ${record.duelLosses ?? 0} lost`,
   },
   trial: {
      name: 'Spire Ladder',
      emoji: '🏟️',
      sortField: 'trialRung',
      format: (record) => `**rung ${record.trialRung ?? 0}/${LADDER_LENGTH}** cleared`,
   },
} as const satisfies Record<string, LeaderboardCategory>;

export type LeaderboardCategoryId = keyof typeof LEADERBOARD_CATEGORIES;

export const LEADERBOARD_CATEGORY_IDS = Object.keys(LEADERBOARD_CATEGORIES) as LeaderboardCategoryId[];

/** The default board when none is picked. */
export const DEFAULT_LEADERBOARD_CATEGORY: LeaderboardCategoryId = 'duels';

/** Resolves a stored/option category id, falling back for an unknown one. */
export function leaderboardCategory(id: string): LeaderboardCategory & { id: LeaderboardCategoryId } {
   const resolved: LeaderboardCategoryId = id in LEADERBOARD_CATEGORIES ? id as LeaderboardCategoryId : DEFAULT_LEADERBOARD_CATEGORY;
   return { id: resolved, ...LEADERBOARD_CATEGORIES[resolved] };
}
