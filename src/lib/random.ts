/**
 * Returns an integer in [min, max] (both inclusive).
 */
export function randomInt(min: number, max: number): number {
   return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Picks a uniformly random element. Throws on an empty array so the return
 * type stays `T` — callers pass non-empty content lists, not user input.
 */
export function randomItem<T>(items: readonly T[]): T {
   if (items.length === 0)
      throw new Error('randomItem called with an empty array.');

   return items[randomInt(0, items.length - 1)];
}

/**
 * True with the given percent probability (0 → never, 100 → always).
 */
export function chance(percent: number): boolean {
   return Math.random() * 100 < percent;
}

/**
 * Picks an element by weight. Replaces the old 2D-array frequency lists with a
 * typed `[item, weight]` form. Weights need not sum to anything in particular.
 */
export function weightedItem<T>(entries: readonly (readonly [T, number])[]): T {
   const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
   let roll = Math.random() * total;

   for (const [item, weight] of entries) {
      roll -= weight;
      if (roll < 0)
         return item;
   }

   return entries[entries.length - 1][0];
}
