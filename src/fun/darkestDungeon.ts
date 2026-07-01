import { randomItem } from '../lib/random.js';

// `h!ddquote` — the Ancestor's narration from Darkest Dungeon. Ported verbatim from
// the old ddQuotes* lists (duplicates removed). Grouped by category so a player can
// ask for a mood; default picks from everything.

export const DD_QUOTES = {
   affliction: [
      "The human mind — fragile like a robin's egg.",
      'Wherefore, heroism?',
      'The mind cannot hope to withstand such an assault.',
      "Even the aged oak will fall to the tempest's winds.",
      'Madness, our old friend!',
      'One can sometimes find clarity in madness, but only rarely...',
      'Madness — sublimity of the intelligence, or so it has been said.',
      'The bulwarks of the mind have fallen!',
      'The abyss is made manifest!',
      'Frustration and fury, more destructive than a hundred cannons.',
      'Fear and frailty finally claim their due.',
      'The walls close in, the shadows whisper of conspiracy!',
      'There can be no hope in this place, no hope at all.',
      'Self-preservation is paramount — at any cost!',
      'Those who covet injury find it in no short supply.',
      'Reeling, gasping, taken over the edge into madness!',
   ],
   virtue: [
      'A moment of valor shines brightest against a backdrop of despair.',
      'Adversity can foster hope, and resilience.',
      'A moment of clarity in the eye of the storm...',
      'Anger is power — unleash it!',
      'Many fall in the face of chaos; but not this one, not today.',
   ],
   crit: [
      'A decisive pummelling!',
      'A powerful blow!',
      'A devastating blow!',
      'Impressive!',
      'The ground quakes!',
      'A singular strike!',
      'Well struck!',
      'Precision and power!',
      'Unnerved, unbalanced...',
   ],
   hit: [
      'How quickly the tide turns!',
      'Grievous injury, palpable fear...',
      'Such a terrible assault cannot be left unanswered!',
      'Death waits for the slightest lapse in concentration.',
      'Exposed to a killing blow!',
      'Ringing ears, blurred vision — the end approaches...',
      'Dazed, reeling, about to break...',
      'A dizzying blow to body and brain!',
   ],
   deathsdoor: [
      'Perched at the very precipice of oblivion...',
      'A hand-breadth from becoming unwound...',
      'Teetering on the brink, facing the abyss...',
      'And now the true test... hold fast, or expire?',
      'As life ebbs, terrible vistas of emptiness reveal themselves.',
   ],
   deathblow: [
      'Survival is a tenuous proposition in this sprawling tomb.',
      'More blood soaks the soil, feeding the evil therein.',
      'Another life wasted in the pursuit of glory and gold.',
      'This is no place for the weak, or foolhardy.',
      'More dust, more ashes, more disappointment.',
   ],
   victory: [
      'These nightmarish creatures can be felled! They can be beaten!',
      "Seize this momentum! Push on to the task's end!",
      'This expedition, at least, promises success.',
      'As victories mount, so too will resistance.',
      'Success so clearly in view... or is it merely a trick of the light?',
      'Remind yourself that overconfidence is a slow and insidious killer.',
      'A trifling victory, but a victory nonetheless.',
      'Be wary — triumphant pride precipitates a dizzying fall...',
      'Ghoulish horrors — brought low and driven into the mud!',
   ],
} as const satisfies Record<string, readonly string[]>;

export type DDCategory = keyof typeof DD_QUOTES;

// Old bot accepted numbers 1–7; keep them working alongside the named categories.
const LEGACY_NUMBERS: Record<string, DDCategory> = {
   '1': 'affliction', '2': 'virtue', '3': 'crit', '4': 'hit', '5': 'deathsdoor', '6': 'deathblow', '7': 'victory',
};

const ALL_QUOTES = Object.values(DD_QUOTES).flat();

/** Resolves a user-typed category (name or legacy 1–7) to a key, or undefined. */
export function resolveDDCategory(input: string | undefined): DDCategory | undefined {
   if (!input)
      return undefined;

   const key = input.toLowerCase();
   if (key in DD_QUOTES)
      return key as DDCategory;

   return LEGACY_NUMBERS[key];
}

/** A random Darkest Dungeon quote — from `category` if given, otherwise from all of them. */
export function darkestDungeonQuote(category?: DDCategory): string {
   return randomItem(category ? DD_QUOTES[category] : ALL_QUOTES);
}
