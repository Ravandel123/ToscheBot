import { chance, randomInt, randomItem } from '../lib/random.js';
import { capitalize } from '../lib/text.js';
import { funnyEnding } from './flavor.js';
import { accuracyPrefix } from './generators.js';

// `h!amount` / `h!percent` / `h!chance` / `h!%` — Tosch makes up a number with a
// straight face. Ported from the old resAmount/resChance/resPercentSpecial. The
// numeric pieces are exported (and pure-ish) so they can be range-tested; the
// phrasings reuse the accuracy prefix + funny ending, like cost.ts.

/**
 * A random order of magnitude: a power of ten from 10 up to 10^maxZeros. Each step
 * multiplies by ten, then has `stopChance`% to stop — so small magnitudes dominate.
 * Ported from the old `genRandomMultiplier`.
 */
export function randomMagnitude(maxZeros = 8, stopChance = 75): number {
   let magnitude = 1;

   for (let i = 0; i < maxZeros; i++) {
      magnitude *= 10;
      if (chance(stopChance))
         break;
   }

   return magnitude;
}

/** A made-up chance value (0–100 most of the time, occasionally up to 200 for comic effect). */
export function chanceValue(): number {
   return chance(90) ? randomInt(0, 100) : randomInt(100, 200);
}

/** A varied "amount of something" reply. `suffix` (e.g. '%') is appended to the number. */
export function amountPhrase(suffix = '', maxZeros = 8): string {
   const amount = `${randomInt(0, randomMagnitude(maxZeros) + 1)}${suffix}`;
   const qualified = `${accuracyPrefix()}${amount}`;

   return randomItem([
      amount,
      `This is ${qualified}`,
      `My calculations show that this is ${qualified}`,
      `I think it's ${qualified}`,
   ]) + funnyEnding();
}

/** A varied percentage reply (small magnitude, '%' suffix). */
export function percentPhrase(): string {
   return amountPhrase('%', 2);
}

/** A varied "the chance for that is N%" reply. */
export function chancePhrase(): string {
   const value = chanceValue();

   return randomItem([
      `${value}%`,
      `${capitalize(accuracyPrefix())}${value}%`,
      `The chance for that is ${value}%`,
      `The chance for that is ${accuracyPrefix()}${value}%`,
   ]) + funnyEnding();
}

/** "Tosch is 73% awesome" — a percentage applied to a target. */
export function percentApplied(who: string, what: string): string {
   const value = chance(50) ? randomInt(0, 100) : randomInt(0, 200);
   return `${who} is ${value}% ${what}${funnyEnding()}`;
}
