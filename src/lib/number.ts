// Generic numeric helpers — parsing command args and rounding. Pure, no Discord.

/**
 * Rounds to at most `decimals` places. The `Number.EPSILON` nudge fixes the
 * classic float artefact (so 1.005 rounds to 1.01, not 1.00). Ported from the old
 * `calcFixMaxDecimal` / `roundNumber` (they were identical).
 */
export function roundTo(value: number, decimals = 2): number {
   const factor = 10 ** Math.max(0, Math.trunc(decimals));
   return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Parses a finite number from a command arg, or null if it isn't one. */
export function parseFiniteNumber(raw: string | undefined): number | null {
   if (raw === undefined || raw.trim() === '')
      return null;

   const value = Number(raw);
   return Number.isFinite(value) ? value : null;
}

/** Parses an integer within `[min, max]` from a command arg, or null otherwise. */
export function parseIntInRange(raw: string | undefined, min: number, max: number): number | null {
   if (raw === undefined)
      return null;

   const value = Number(raw);
   return Number.isInteger(value) && value >= min && value <= max ? value : null;
}
