import { chance, randomItem } from '../lib/random.js';
import { ADJECTIVES } from '../grammar/vocabulary/adjectives.js';
import { ADVERBS } from '../grammar/vocabulary/adverbs.js';
import { NOUNS } from '../grammar/vocabulary/nouns.js';

// Reusable fragment generators — small functions that compose a varied string
// from the shared vocabulary. Ported from the old `generators.js` (genPersonalInsult,
// genAccuracy, …). Use them anywhere; commands stay thin. (`funnyEnding` lives in
// flavor.ts.)

/** A random good-natured insult: "noob" / "drooly troglodyte" (adjective 75% of the time). */
export function personalInsult(): string {
   const adjective = chance(75) ? `${randomItem(ADJECTIVES.insult)} ` : '';
   return `${adjective}${randomItem(NOUNS.insult)}`;
}

/** An accuracy qualifier with a trailing space when present, else '': "over " / "exactly " / "". */
export function accuracyPrefix(): string {
   const term = randomItem(ADVERBS.accuracy);
   return term ? `${term} ` : '';
}

/** A "without a doubt"-style certainty term, e.g. "beyond any doubt". */
export function certaintyTerm(): string {
   return randomItem(ADVERBS.certainty);
}
