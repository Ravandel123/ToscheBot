import type { RaceId } from './races.js';

// Body & condition catalog (R20). A character's frame is described by concrete
// metric numbers (weight/height/age) — the dropped "Size" tier is replaced by
// values derived from these. All numbers here are 🟡 balance placeholders; the
// SHAPE (bands, per-race ranges) is the stable part. No consumer applies age or
// move to a formula yet — they're stored + displayed groundwork (D14 stance:
// structure now, mechanics when the ruleset locks them).

/** A body-shape band, derived from BMI (weight ÷ height²). Ascending, non-
 *  overlapping — the first band whose `maxBmi` the value is under wins. */
export interface BodyShapeBand {
   name: string;
   maxBmi: number;
}

export const BODY_SHAPE_BANDS = [
   { name: 'gaunt', maxBmi: 17 },
   { name: 'lean', maxBmi: 21 },
   { name: 'average', maxBmi: 27 },
   { name: 'stocky', maxBmi: 33 },
   { name: 'heavy', maxBmi: Infinity },
] as const satisfies readonly BodyShapeBand[];

/** Coarse age band (young/prime/old) — feeds display today and the future age
 *  stat curve (🟡, not wired). First band whose `maxAge` the value is under. */
export interface AgeBand {
   name: string;
   maxAge: number;
}

export const AGE_BANDS = [
   { name: 'young', maxAge: 18 },
   { name: 'prime', maxAge: 46 },
   { name: 'old', maxAge: Infinity },
] as const satisfies readonly AgeBand[];

/** Per-race default frame ranges + base walking Move (character.md's Move
 *  column). A fresh character's body starts at the midpoint of these ranges;
 *  players tweak it on the creation panel. 🟡 placeholder frames. */
export interface RaceBody {
   heightCm: readonly [min: number, max: number];
   weightKg: readonly [min: number, max: number];
   baseMove: number;
}

export const RACE_BODY = {
   canid: { heightCm: [175, 200], weightKg: [70, 110], baseMove: 4 },
   ermehn: { heightCm: [155, 180], weightKg: [50, 80], baseMove: 5 },
   felis: { heightCm: [150, 175], weightKg: [45, 70], baseMove: 5 },
   lutren: { heightCm: [150, 175], weightKg: [50, 80], baseMove: 3 },
   polcan: { heightCm: [160, 185], weightKg: [65, 100], baseMove: 4 },
   tamian: { heightCm: [120, 150], weightKg: [30, 55], baseMove: 4 },
   vulpin: { heightCm: [150, 175], weightKg: [45, 75], baseMove: 4 },
} as const satisfies Record<RaceId, RaceBody>;

/** Frame for a character whose race isn't chosen yet (a draft mid-wizard). */
export const DEFAULT_RACE_BODY: RaceBody = { heightCm: [150, 185], weightKg: [50, 85], baseMove: 4 };

/** Default adult age for a fresh character (🟡). */
export const DEFAULT_AGE = 22;

// Sane input bounds for the body modal (loose — species vary; 🟡).
export const BODY_LIMITS = {
   heightCm: { min: 60, max: 260 },
   weightKg: { min: 10, max: 400 },
   age: { min: 1, max: 500 },
} as const;
