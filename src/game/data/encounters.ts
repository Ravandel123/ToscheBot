import type { ActivityType } from '../../db/models/activitySession.js';

// Travel-encounter catalog (D21): things that can happen on the road. Two
// kinds, matching the two action shapes of the game:
//   'flavor'   — instant; a line of text, no state change, the move completes;
//   'activity' — interactive; the move is INTERRUPTED and a durable
//                ActivitySession of `activityType` runs (D17); arrival happens
//                only if the activity ends in success.
// PLACEHOLDER content — expand freely; outcomes with real mechanics (damage,
// loot) wait for the Phase 7 ruleset (D14). Ids are stable slugs (D10).

interface EncounterBase {
   name: string;
   /** Destination ids this encounter can fire on, or 'anywhere'. */
   locations: readonly string[] | 'anywhere';
   /** Relative pick weight within the eligible pool. */
   weight: number;
}

export interface FlavorEncounter extends EncounterBase {
   kind: 'flavor';
   /** One is appended to the arrival message (and the chronicle line). */
   lines: readonly [string, ...string[]];
}

export interface ActivityEncounter extends EncounterBase {
   kind: 'activity';
   activityType: ActivityType;
   /** Shown when the encounter interrupts the journey. */
   intro: string;
}

export type EncounterDefinition = FlavorEncounter | ActivityEncounter;

/** Chance that any encounter fires on a travel move. PLACEHOLDER tunable. */
export const TRAVEL_ENCOUNTER_CHANCE_PERCENT = 25;

export const ENCOUNTERS = {
   patrol_gossip: {
      name: 'A passing patrol',
      kind: 'flavor',
      locations: 'anywhere',
      weight: 3,
      lines: [
         'A Canid patrol marches past, trading rumors about the Imperator\'s mood.',
         'You pass a patrol arguing about whose turn it is to carry the banner.',
      ],
   },
   dropped_ribbon: {
      name: 'Something on the road',
      kind: 'flavor',
      locations: 'anywhere',
      weight: 2,
      lines: [
         'You spot a torn ribbon in the mud — someone left in a hurry.',
         'A crow watches you from a fencepost, unimpressed.',
      ],
   },
   fallen_tree: {
      name: 'A fallen tree',
      kind: 'activity',
      activityType: 'obstacle',
      locations: ['riverbank', 'tavern'],
      weight: 3,
      intro: 'A storm-felled tree blocks the road. You will have to climb over it.',
   },
} as const satisfies Record<string, EncounterDefinition>;

export type EncounterId = keyof typeof ENCOUNTERS;
