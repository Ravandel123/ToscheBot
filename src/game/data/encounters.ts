import type { ActivityType } from '../../db/models/activitySession.js';
import type { CheckDefinition } from '../checks.js';
import type { LocationCondition } from '../world/conditions.js';
import type { TraitKey } from './traits.js';

// Travel-encounter catalog (D21/D26): things that can happen on the road. Two
// kinds, matching the two action shapes of the game:
//   'flavor'   — instant; a line of text, no state change, the move completes;
//   'activity' — interactive; the move is INTERRUPTED and a durable 'challenge'
//                ActivitySession runs (D17). A challenge exposes SEVERAL
//                approaches (RPG/'s multi-approach model): most are d100
//                roll-under checks (game/checks.ts) — pick the one your build
//                is good at — and some are free choices that shape your deed
//                traits instead (ignore the drowning stranger → cowardice).
// 🟡 Content and numbers are placeholder; the check SHAPE is the stable part.
// Ids (encounters AND option ids) are stable slugs (D10) — they ride in
// session state and customIds.

interface EncounterBase {
   name: string;
   /** Destination ids this encounter can fire on, or 'anywhere'. */
   locations: readonly string[] | 'anywhere';
   /** Relative pick weight within the eligible pool. */
   weight: number;
   /** When it can fire (D31): time of day, weather, running events, traits… —
    *  the owner's "character walks in and, if a criterion holds, something
    *  happens". Omitted = always eligible. */
   conditions?: LocationCondition;
}

export interface FlavorEncounter extends EncounterBase {
   kind: 'flavor';
   /** One is appended to the arrival message (and the chronicle line). */
   lines: readonly [string, ...string[]];
   /** A location feature this sighting reveals (→ LocationFeature.id, D31). */
   discovers?: string;
}

/** How one attempted approach ends — or doesn't. */
export interface ChallengeOutcome {
   /** 'proceed' → the journey completes (arrival); 'turn-back' → the challenge
    *  is over and the character stays at the origin; 'retry' → still ongoing
    *  (a failed check that retries also counts a setback — enough setbacks and
    *  the road wins). */
   result: 'proceed' | 'turn-back' | 'retry';
   lines: readonly [string, ...string[]];
   /** Deed-trait deltas this outcome inflicts/earns (D26). */
   traits?: Partial<Record<TraitKey, number>>;
   /** A location feature this outcome reveals at the DESTINATION (D31). */
   discovers?: string;
}

/** One approach to a challenge — a button on the encounter panel. */
export interface ChallengeOption {
   /** Stable slug; rides in `activity:opt:<sessionId>:<optionId>` customIds. */
   id: string;
   label: string;
   emoji: string;
   /** Shown in the encounter embed next to the player's % chance. */
   description: string;
   /** The d100 test this approach rolls; omitted = it simply happens (`success` applies). */
   check?: CheckDefinition;
   /** A failed attempt retires this approach for the rest of the challenge. */
   oneShot?: boolean;
   success: ChallengeOutcome;
   /** Required when `check` is set (a checkless option always succeeds). */
   failure?: ChallengeOutcome;
}

export interface ActivityEncounter extends EncounterBase {
   kind: 'activity';
   activityType: ActivityType;
   /** Shown when the encounter interrupts the journey. */
   intro: string;
   options: readonly [ChallengeOption, ...ChallengeOption[]];
   /** Failed retries before the challenge forces the character back. */
   maxSetbacks: number;
}

export type EncounterDefinition = FlavorEncounter | ActivityEncounter;

/** Chance that any encounter fires on a travel move. PLACEHOLDER tunable. */
export const TRAVEL_ENCOUNTER_CHANCE_PERCENT = 70;

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
   // --- Conditional encounters (D31): fire only when their criteria hold -------
   soaked_traveler: {
      name: 'Soaked through',
      kind: 'flavor',
      locations: 'anywhere',
      weight: 2,
      conditions: { weather: ['rain', 'storm'] },
      lines: [
         'The rain finds every gap in your cloak before you are halfway there.',
         'You arrive dripping; a puddle forms around your boots within moments.',
      ],
   },
   grateful_beggar: {
      name: 'A grateful beggar',
      kind: 'flavor',
      locations: ['plaza'],
      weight: 2,
      conditions: { minTraits: { empathy: 1 } },
      lines: [
         'A beggar catches your sleeve — "I heard what you did by the river. Deltrada sees, friend."',
      ],
   },
   reed_glimmer: {
      name: 'A glimmer in the reeds',
      kind: 'flavor',
      locations: ['riverbank'],
      weight: 4,
      conditions: { timeOfDay: ['night'] },
      discovers: 'old_jetty',
      lines: [
         'Moonlight catches on something among the reeds — worn planks, rotted rope… the river has not quite swallowed an old jetty.',
      ],
   },
   fallen_tree: {
      name: 'A fallen tree',
      kind: 'activity',
      activityType: 'challenge',
      locations: ['riverbank', 'tavern'],
      weight: 3,
      intro: 'A storm-felled tree blocks the road, branches tangled like a barricade.',
      maxSetbacks: 3,
      options: [
         {
            id: 'climb',
            label: 'Climb over',
            emoji: '🧗',
            description: 'Scramble up the trunk and drop down the far side.',
            check: { attribute: 'agility' },
            success: { result: 'proceed', lines: ['You find a solid hold, haul yourself up and drop onto the road beyond.'] },
            failure: { result: 'retry', lines: ['Your grip slips on wet bark and you slide back down.', 'A branch snaps under you — back to the start.'] },
         },
         {
            id: 'heave',
            label: 'Heave it aside',
            emoji: '💪',
            description: 'Put your shoulder into the trunk and make a gap.',
            check: { attribute: 'strength' },
            success: { result: 'proceed', lines: ['Wood groans, roots tear — you shove the trunk far enough to squeeze past.'] },
            failure: { result: 'retry', lines: ['The trunk does not budge an inch; your arms burn.', 'It shifts a hand\'s width, then settles back with a thud.'] },
         },
         {
            id: 'search',
            label: 'Search for a way around',
            emoji: '🔍',
            description: 'Study the tangle for a gap the storm left open.',
            check: { attribute: 'perception' },
            oneShot: true,
            success: { result: 'proceed', lines: ['There — a game trail skirts the roots. You slip through untouched.'] },
            failure: { result: 'retry', lines: ['Brambles and mud on both sides; if there is a way around, you cannot see it.'] },
         },
      ],
   },
   drowning_stranger: {
      name: 'A cry from the river',
      kind: 'activity',
      activityType: 'challenge',
      locations: ['riverbank'],
      weight: 2,
      intro: 'Someone is thrashing in the current, going under — their cries are getting weaker.',
      maxSetbacks: 2,
      options: [
         {
            id: 'swim',
            label: 'Dive in after them',
            emoji: '🏊',
            description: 'Swim out and drag them back to shore.',
            check: { node: 'swimming', raceAffinity: { lutren: 1.5 } },
            success: {
               result: 'proceed',
               lines: ['You cut through the current, catch them by the collar and haul them, coughing, onto the bank.'],
               traits: { courage: 1, empathy: 1 },
            },
            failure: {
               result: 'retry',
               lines: ['The current wrenches you back — you gasp and regroup on the shallows.', 'You lunge and miss; the river drags them further out.'],
            },
         },
         {
            id: 'branch',
            label: 'Find a long branch',
            emoji: '🌿',
            description: 'Spot something to reach them without getting wet.',
            check: { attribute: 'perception' },
            success: {
               result: 'proceed',
               lines: ['A fallen sapling! You thrust it out; they clamp on and you drag them ashore.'],
               traits: { empathy: 1 },
            },
            failure: {
               result: 'retry',
               lines: ['Nothing on this stretch of bank but pebbles and reeds.'],
            },
         },
         {
            id: 'ignore',
            label: 'Walk on',
            emoji: '🚶',
            description: 'Not your problem. Someone else will come along.',
            success: {
               result: 'proceed',
               lines: ['You fix your eyes on the road and quicken your pace until the cries fade behind you.'],
               traits: { cowardice: 1 },
            },
         },
      ],
   },
} as const satisfies Record<string, EncounterDefinition>;

export type EncounterId = keyof typeof ENCOUNTERS;
