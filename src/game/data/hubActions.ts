// The location action catalog — what a character can DO at the place they
// are standing, surfaced as buttons on the `/play` hub. Travel is NOT here: it
// is the hub's one structurally-distinct action (a destination picker), routed
// specially.
//
// An entry with a `comingSoon` line is UNBUILT: it stays here as the plan for
// that location but the hub never shows it. Making it live = remove the line
// and add its executor to HUB_EXECUTORS in the `play` component. Ids are stable
// slugs — they ride in `play:act:<id>` customIds.

import type { LocationCondition } from '../world/conditions.js';

export interface HubActionAvailability extends LocationCondition {
   /** When unavailable: true = hide the action entirely (undiscovered secrets),
    *  false/absent = show it closed with the reason ("only during the morning"). */
   hidden?: boolean;
}

export interface HubAction {
   /** Stable slug; rides in the `play:act:<id>` customId. */
   id: string;
   label: string;
   emoji: string;
   /** One line shown in the hub embed's action list. */
   description: string;
   /** Location ids that offer this action; 'anywhere' = every location. */
   locations: readonly string[] | 'anywhere';
   /** When the action can be used; omitted = always. Evaluated live —
    *  when the hub renders AND again when the button is clicked (stale panels). */
   availability?: HubActionAvailability;
   /** In-character line shown when the (not-yet-built) action is used.
    *  ABSENT = the action is LIVE: the `play` router owns a real handler case. */
   comingSoon?: string;
}

export const HUB_ACTIONS = {
   // --- Live ---------------------------------------------------------------
   arena: {
      id: 'arena',
      label: 'Enter the arena',
      emoji: '🏟️',
      description: 'Climb the Spire ladder — pick a champion and fight.',
      locations: ['spire'],
   },

   // --- Available everywhere (the three the owner called out) ------------------
   search: {
      id: 'search',
      label: 'Search the area',
      emoji: '🔍',
      description: 'Comb the surroundings for anything worth finding.',
      locations: 'anywhere',
      comingSoon: 'You case the ground and the shadows, but Tosch has not yet mapped what is worth finding here.',
   },
   // LIVE: opens the NPC picker → a durable dialogue session. The
   // play router owns the handler case; no comingSoon = live. Offered anywhere —
   // a location with no talkable NPC present degrades to a gentle banner.
   talk: {
      id: 'talk',
      label: 'Talk to someone',
      emoji: '💬',
      description: 'Find a local to trade words — or rumors.',
      locations: 'anywhere',
   },
   enter: {
      id: 'enter',
      label: 'Enter a building',
      emoji: '🏛️',
      description: 'Step inside one of the buildings around you.',
      locations: 'anywhere',
      comingSoon: 'The doors are here, but their rooms are still being built, yes-yes.',
   },

   // --- Location-flavored placeholders (demonstrate per-place activity tables) --
   audience: {
      id: 'audience',
      label: 'Seek an audience',
      emoji: '📜',
      description: 'Petition the Imperator\'s court.',
      locations: ['spire'],
      comingSoon: 'The court is not yet hearing petitions — the Imperator is, ah, indisposed.',
   },
   // LIVE: opens the stall of the merchant NPC who keeps shop here
   // (game/data/shops.ts). The same availability is re-checked on every trade.
   market: {
      id: 'market',
      label: 'Browse the market',
      emoji: '🪙',
      description: 'Buy from the plaza stall, or sell what you carry.',
      locations: ['plaza'],
      // The owner's canonical example: shops keep daylight hours.
      availability: { timeOfDay: ['morning', 'day'] },
   },
   drink: {
      id: 'drink',
      label: 'Order a drink',
      emoji: '🍺',
      description: 'Settle in at the Sunken Tankard.',
      locations: ['tavern'],
      comingSoon: 'The taps are dry for now — the tavernkeeper is still learning to pour.',
   },
   gamble: {
      id: 'gamble',
      label: 'Play Mearog',
      emoji: '🎲',
      description: 'Chance a few coins at the dice table.',
      locations: ['tavern'],
      availability: { timeOfDay: ['evening', 'night'] },
      comingSoon: 'The dice are still being carved. Keep your coins a while longer.',
   },
   listen: {
      id: 'listen',
      label: 'Join the singing',
      emoji: '🎻',
      description: 'Pull up a stool and add your voice to the bards\' racket.',
      locations: ['tavern'],
      availability: { duringEvent: 'bards_night' },
      comingSoon: 'The bards nod along politely, but their songbook is still being written.',
   },
   fish: {
      id: 'fish',
      label: 'Cast a line',
      emoji: '🎣',
      description: 'Try the river for a catch.',
      locations: ['riverbank'],
      comingSoon: 'The fish are here, but the rods have not been strung yet.',
   },
   // LIVE: the first real gather action — no comingSoon; the play router
   // hands it to performForage. Locations must match where a foraging resource
   // node exists (test-validated against the catalogs).
   forage: {
      id: 'forage',
      label: 'Forage',
      emoji: '🌿',
      description: 'Search the greenery for anything edible, useful — or sellable.',
      locations: ['riverbank', 'tanglewood'],
   },
   jetty: {
      id: 'jetty',
      label: 'Search the old jetty',
      emoji: '🛶',
      description: 'Pick through the rotted pilings the river almost swallowed.',
      locations: ['riverbank'],
      // Invisible until somebody finds the jetty (a night encounter reveals it).
      availability: { requiresDiscovery: 'old_jetty', hidden: true },
      comingSoon: 'Black water gurgles between the planks. Whatever the jetty hides, it is not giving it up yet.',
   },
} as const satisfies Record<string, HubAction>;

export type HubActionId = keyof typeof HUB_ACTIONS;

/** The actions offered at a given location (its 'anywhere' + place-specific set).
 *  Widen off the `as const` tuple so `locations.includes(string)` type-checks. */
export function actionsAt(locationId: string): HubAction[] {
   return (Object.values(HUB_ACTIONS) as HubAction[]).filter(
      (action) => action.locations === 'anywhere' || action.locations.includes(locationId),
   );
}

/** Resolves a stored/customId action slug, tolerating unknown ids. */
export function hubAction(id: string): HubAction | undefined {
   return HUB_ACTIONS[id as HubActionId];
}
