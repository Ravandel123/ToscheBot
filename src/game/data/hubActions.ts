// The location action catalog (D10) — what a character can DO at the place they
// are standing, surfaced as buttons on the `/play` hub. Travel is NOT here: it
// is the hub's one structurally-distinct action (a destination picker), routed
// specially. Everything in this catalog is currently a PLACEHOLDER — the button
// exists and shows an in-character "coming soon" line — so the hub already
// reads as a rich, per-location activity board (the backlog's "locations =
// activity tables" idea) while the real activities are built one at a time.
//
// Turning a placeholder into a real action later = flip it to a handler in the
// `play` component router (one case), keeping this catalog as the single source
// of what each location offers. Ids are stable slugs (D10) — they ride in
// `play:act:<id>` customIds.

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
   /** When the action can be used (D31); omitted = always. Evaluated live —
    *  when the hub renders AND again when the button is clicked (stale panels). */
   availability?: HubActionAvailability;
   /** In-character line shown when the (not-yet-built) action is used. */
   comingSoon: string;
}

export const HUB_ACTIONS = {
   // --- Available everywhere (the three the owner called out) ------------------
   search: {
      id: 'search',
      label: 'Search the area',
      emoji: '🔍',
      description: 'Comb the surroundings for anything worth finding.',
      locations: 'anywhere',
      comingSoon: 'You case the ground and the shadows, but Tosch has not yet mapped what is worth finding here.',
   },
   talk: {
      id: 'talk',
      label: 'Talk to someone',
      emoji: '💬',
      description: 'Find a local to trade words — or rumors.',
      locations: 'anywhere',
      comingSoon: 'The folk here have plenty to say, but none of them have learned their lines yet.',
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
   market: {
      id: 'market',
      label: 'Browse the market',
      emoji: '🪙',
      description: 'See what the plaza stalls are selling today.',
      locations: ['plaza'],
      // The owner's canonical example (D31): shops keep daylight hours.
      availability: { timeOfDay: ['morning', 'day'] },
      comingSoon: 'The stalls are still setting up their wares. Come back when the economy opens.',
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

/** Resolves a stored/customId action slug, tolerating unknown ids (D10 rule 3). */
export function hubAction(id: string): HubAction | undefined {
   return HUB_ACTIONS[id as HubActionId];
}
