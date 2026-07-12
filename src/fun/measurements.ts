import { chance, randomInt, randomItem } from '../lib/random.js';
import { accuracyPrefix } from './generators.js';
import { randomMagnitude } from './amount.js';
import { funnyEnding } from './flavor.js';
import { NOUNS } from '../grammar/vocabulary/nouns.js';
import { bold } from '../lib/text.js';

// `h!weight` / `h!height` / `h!capacity` / `h!size` / `h!when` / `h!where` — Tosch
// measures things he cannot possibly measure, with total confidence. Ported from the
// old measurement switch cases. Units are command-specific joke data (kept here, not
// in the shared vocabulary); the numeric core reuses amount.ts's randomMagnitude.

export const WEIGHT_UNITS = ['decagrams', 'grams', 'kilograms', 'ounces', 'pounds', 'tons'] as const;
export const LENGTH_UNITS = ['centimeters', 'decimeters', 'feet', 'inches', 'kilometers', 'meters', 'miles', 'millimeters', 'yards'] as const;
export const VOLUME_UNITS = ['cubic meters', 'cups', 'gallons', 'liters', 'milliliters', 'pints', 'quarts'] as const;
export const TIME_UNITS = ['seconds', 'minutes', 'hours', 'days', 'years'] as const;

export const GALAXIES = ['Andromeda', 'Messier 49', 'NGC 1399', 'NGC 4261', 'M60-UCD1', 'Markarian 335'] as const;

export const SIZES_BIG = ['astronomical', 'big', 'colossal', 'enormous', 'gargantuan', 'giant', 'gigantic', 'huge', 'large', 'monstrous', 'tremendous'] as const;
export const SIZES_SMALL = ['diminutive', 'little', 'small', 'tiny'] as const;
export const SIZES_AVERAGE = ['average', 'medium'] as const;

/** "definitely 7 tons" — a made-up quantity with an accuracy qualifier and a random unit. */
export function measuredQuantity(units: readonly string[]): string {
   const value = randomInt(1, randomMagnitude(2) + 1);
   return `${accuracyPrefix()}${value} ${randomItem(units)}`;
}

/**
 * A full measurement reply for `units`. `specialChance`% of the time it dodges with one
 * of `specials` ("Immeasurable!", "Too heavy."); otherwise it states a made-up quantity.
 */
export function measurePhrase(units: readonly string[], specials: readonly string[], specialChance = 15): string {
   if (chance(specialChance))
      return randomItem(specials);

   return randomItem([
      `It's ${measuredQuantity(units)}`,
      `That's ${measuredQuantity(units)}`,
      `Around ${measuredQuantity(units)}`,
      `Exactly ${measuredQuantity(units)}`,
      `I'd say ${measuredQuantity(units)}`,
   ]) + funnyEnding();
}

const COMMON_DODGES = ['Immeasurable!', 'Infinite!', 'Dunno!', "I don't know!", "I won't tell you!"] as const;

export const weightPhrase = (): string =>
   measurePhrase(WEIGHT_UNITS, [`That is beyond the mass of the supermassive black hole in the ${randomItem(GALAXIES)} galaxy.`, 'Too light.', 'Too heavy.', ...COMMON_DODGES]);

export const lengthPhrase = (): string =>
   measurePhrase(LENGTH_UNITS, ['Beyond the horizon.', 'Too short.', 'Too long.', 'I think that might soon reach the Moon.', ...COMMON_DODGES]);

export const capacityPhrase = (): string =>
   measurePhrase(VOLUME_UNITS, ['That is beyond the capacity of all the oceans combined.', 'Not capacious enough.', 'Too capacious.', ...COMMON_DODGES]);

/** "That is colossal." — a size adjective from one of the three pools. */
export function sizePhrase(): string {
   if (chance(15))
      return randomItem(['This is the biggest thing I have ever seen!', 'This is the smallest thing I have ever seen!', 'Immeasurable!', 'I fear that size!', ...COMMON_DODGES]);

   const size = randomItem([...SIZES_BIG, ...SIZES_SMALL, ...SIZES_AVERAGE]);
   return randomItem([`That is ${size}`, `${size[0].toUpperCase()}${size.slice(1)}`, `Too ${size}`]) + funnyEnding();
}

/** A made-up answer to "when?": a fixed quip half the time, else a concrete-sounding time. */
export function whenPhrase(): string {
   if (chance(50))
      return randomItem(['Today.', 'Tomorrow.', 'Soon.', 'Now.', 'Never.', 'Never, lol.', 'Yesterday.', "You don't grasp the concept of time anyway."]);

   const hh = String(randomInt(0, 23)).padStart(2, '0');
   const mm = String(randomInt(0, 59)).padStart(2, '0');

   return randomItem([
      `In ${randomInt(1, randomMagnitude(2) + 1)} ${randomItem(TIME_UNITS)}.`,
      `Tomorrow at ${hh}:${mm}.`,
      `The day after tomorrow at ${hh}:${mm}.`,
   ]);
}

/** A made-up answer to "where?": a random (joke) place, in a varied frame. */
export function wherePhrase(): string {
   const place = bold(randomItem(NOUNS.furryCon));
   return randomItem([place, `In ${place}.`, `Somewhere near ${place}.`, `Last I saw, ${place}.`]);
}
