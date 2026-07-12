import { chance, randomItem } from '../lib/random.js';
import { bold } from '../lib/text.js';
import { NOUNS } from '../grammar/vocabulary/nouns.js';
import { randomPerson } from './people.js';

// `h!mood` — what Tosch is "currently" up to. Ported from the old mood case: a
// continuous verb + (optionally a person) + a place.

const SOLO_ACTIVITIES = [
   'Awooing', 'Chirping', 'Dancing', 'Drawing', 'Drinking', 'Eating', 'Feeding', 'Gaming', 'Looking around',
   'Paying', 'Playing', 'Ranting', 'Screaming', 'Sketching', 'Sleeping', 'Sulking', 'Swimming', 'Taking a dump',
   'Whipping',
] as const;

const SOCIAL_ACTIVITIES = [
   'Apologizing to', 'Assaulting', 'Awooing with', 'Beating', 'Buying', 'Chirping with', 'Complimenting',
   'Dancing with', 'Drinking with', 'Eating with', 'Feeding', 'Gaming with', 'Ignoring', 'Kicking', 'Observing',
   'Partying with', 'Petting', 'Playing with', 'Ranting at', 'Screaming at', 'Sketching', 'Swimming with',
   'Taking a dump with', 'Verbally abusing', 'Whipping',
] as const;

const PREPOSITIONS = ['at', 'in', 'on'] as const;

/** Tosch's current mood/activity, e.g. "Dancing with Ravandel at Anthrocon." */
export function moodPhrase(): string {
   const place = `${randomItem(PREPOSITIONS)} ${bold(randomItem(NOUNS.furryCon))}`;

   return chance(50)
      ? `${randomItem(SOCIAL_ACTIVITIES)} ${randomPerson()} ${place}.`
      : `${randomItem(SOLO_ACTIVITIES)} ${place}.`;
}
