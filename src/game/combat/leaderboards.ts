import { LADDER_LENGTH } from './spireLadder.js';
import type { SmackdownRecordDoc } from '../../db/models/smackdownRecord.js';

// Leaderboard categories — the data-driven "different boards" the Spire is meant
// to grow (D10). A category is just a way to RANK and RENDER the one record set:
// adding one = a catalog entry (+ a record field if it needs new data). Consumed
// by /leaderboard's picker and smackdownService.getLeaderboard.
//
// SEAM for expansion: today every category ranks the single global ladder. A
// PER-MODE ladder (a separate board for Bare-Knuckle, or a PvE Trial ladder) is
// the natural next step — it adds a `mode`/`board` dimension to SmackdownRecord
// (or a second collection) and a filter here; the picker shape already fits it.

export interface LeaderboardCategory {
   name: string;
   emoji: string;
   /** The numeric SmackdownRecord field ranked (descending). */
   sortField: 'eloRating' | 'wins' | 'trialRung';
   /** One row's stat text after the fighter's name. */
   format(record: SmackdownRecordDoc): string;
}

export const LEADERBOARD_CATEGORIES = {
   elo: {
      name: 'Ranking',
      emoji: '📊',
      sortField: 'eloRating',
      format: (record) => `**${record.eloRating}** ELO · ${record.wins}W / ${record.losses}L`,
   },
   wins: {
      name: 'Most Victories',
      emoji: '🏆',
      sortField: 'wins',
      format: (record) => `**${record.wins}** wins · ${record.losses}L · ${record.eloRating} ELO`,
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
export const DEFAULT_LEADERBOARD_CATEGORY: LeaderboardCategoryId = 'elo';

/** Resolves a stored/option category id, falling back for an unknown one (D10 rule 3). */
export function leaderboardCategory(id: string): LeaderboardCategory & { id: LeaderboardCategoryId } {
   const resolved: LeaderboardCategoryId = id in LEADERBOARD_CATEGORIES ? id as LeaderboardCategoryId : DEFAULT_LEADERBOARD_CATEGORY;
   return { id: resolved, ...LEADERBOARD_CATEGORIES[resolved] };
}
