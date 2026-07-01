import { chance, randomItem } from '../lib/random.js';

// Tosch's signature verbal tics. The old bot sprinkled these onto ~25% of fun
// responses (`additionalWordList1` / `additionalFunnyWords`) — keep that spirit.
export const FUNNY_WORDS = ['lol', 'yes-yes', 'lmao', 'xD'] as const;

/**
 * Builds a sentence ending that, 25% of the time, slips in a funny word before
 * the punctuation: `funnyEnding('.')` → `'.'` or `', yes-yes.'`. Use when you
 * construct a sentence without its own trailing punctuation.
 */
export function funnyEnding(endingChar = '.', percent = 25): string {
   return (chance(percent) ? `, ${randomItem(FUNNY_WORDS)}` : '') + endingChar;
}
