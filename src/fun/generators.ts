import { chance, randomItem } from '../lib/random.js';
import { ACCURACY_TERMS, INSULT_ADJECTIVES, INSULT_NOUNS, NO_DOUBT_TERMS } from '../lexicon.js';

// Reusable fragment generators — small functions that compose a varied string
// from the lexicon. Ported from the old `generators.js` (genPersonalInsult,
// genAccuracy, …). Use them anywhere; commands stay thin. (`funnyEnding` lives in
// flavor.ts.)

/** A random good-natured insult: "noob" / "drooly troglodyte" (adjective 75% of the time). */
export function personalInsult(): string {
   const adjective = chance(75) ? `${randomItem(INSULT_ADJECTIVES)} ` : '';
   return `${adjective}${randomItem(INSULT_NOUNS)}`;
}

/** An accuracy qualifier with a trailing space when present, else '': "over " / "exactly " / "". */
export function accuracyPrefix(): string {
   const term = randomItem(ACCURACY_TERMS);
   return term ? `${term} ` : '';
}

/** A "without a doubt"-style certainty term, e.g. "beyond any doubt". */
export function certaintyTerm(): string {
   return randomItem(NO_DOUBT_TERMS);
}
