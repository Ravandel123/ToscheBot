import { chance, randomInt, randomItem } from '../lib/random.js';
import { expand, type Grammar } from '../grammar/compose.js';
import { funnyEnding } from './flavor.js';
import { accuracyPrefix } from './generators.js';
import { NOUNS } from '../grammar/vocabulary/nouns.js';

// `h!cost <thing>` — Tosch appraises the price of something. A worked example of
// the data + generator + grammar pattern: phrasings live in a grammar (varied,
// not a fixed line), the price is computed and **injected as a runtime symbol**,
// and the shared vocabulary supplies the currency. The command file stays a one-liner.

const PRICED_GRAMMAR: Grammar = {
   // `#price#` is supplied per call (see below) — the grammar itself is static.
   origin: ['#price#', 'That costs #price#', 'That is worth #price#', 'The price for that is #price#'],
};

const SPECIAL_GRAMMAR: Grammar = {
   origin: ['That is worthless', 'That is priceless', 'The only acceptable payment for that is #payment#'],
   payment: ['your firstborn', 'a burning Ermehn village', "the Imperator's favour", 'three good fish', 'your immortal soul'],
};

/** Composes one varied appraisal (with Tosch's occasional verbal tic). */
export function costPhrase(): string {
   if (chance(10))
      return expand(SPECIAL_GRAMMAR) + funnyEnding();

   const amount = randomInt(1, randomItem([10, 100, 1000]));
   const price = `${accuracyPrefix()}${amount} ${randomItem(NOUNS.currency)}`;

   // Merge the runtime `price` symbol into the static grammar, then expand.
   return expand({ ...PRICED_GRAMMAR, price: [price] }) + funnyEnding();
}
