import { AGE_BANDS, BODY_LIMITS, BODY_SHAPE_BANDS, DEFAULT_AGE, DEFAULT_RACE_BODY, RACE_BODY } from '../data/body.js';
import { bmi } from '../../lib/units.js';
import type { AttributeKey } from '../data/attributes.js';
import type { RaceId } from '../data/races.js';

// Pure body math (R20) — no Discord, no DB. Weight/height/age are STORED metric;
// body-shape and move speed are DERIVED (never stored) so they can't disagree
// with the numbers. Same "stored, not derived on read" stance as attributes,
// inverted: here the derivations are cheap and always recomputed.

export interface CharacterBody {
   heightCm: number;
   weightKg: number;
   age: number;
}

/** The race's frame ranges + base move (falls back to a neutral frame for a
 *  raceless draft). */
function raceBody(race: RaceId | null): typeof DEFAULT_RACE_BODY {
   return race ? RACE_BODY[race] : DEFAULT_RACE_BODY;
}

const midpoint = ([min, max]: readonly [number, number]): number => Math.round((min + max) / 2);

/** A sensible default frame for a fresh character: the midpoint of its race's
 *  ranges + a default adult age. Deterministic (players tweak it on the panel). */
export function defaultBody(race: RaceId | null): CharacterBody {
   const frame = raceBody(race);
   return { heightCm: midpoint(frame.heightCm), weightKg: midpoint(frame.weightKg), age: DEFAULT_AGE };
}

/** A complete body for a character, filling any missing field (pre-R20 docs have
 *  no `body` subdoc) from the race default. */
export function bodyOf(character: { body?: Partial<CharacterBody>; identity: { race: RaceId | null } }): CharacterBody {
   const fallback = defaultBody(character.identity.race);
   const raw = character.body ?? {};
   return {
      heightCm: finiteOr(raw.heightCm, fallback.heightCm),
      weightKg: finiteOr(raw.weightKg, fallback.weightKg),
      age: finiteOr(raw.age, fallback.age),
   };
}

/** The BMI-derived body-shape label (gaunt … heavy). */
export function bodyShapeName(body: CharacterBody): string {
   const value = bmi(body.heightCm, body.weightKg);
   return (BODY_SHAPE_BANDS.find((band) => value < band.maxBmi) ?? BODY_SHAPE_BANDS[BODY_SHAPE_BANDS.length - 1]).name;
}

/** The coarse age band (young/prime/old). */
export function ageBandName(age: number): string {
   return (AGE_BANDS.find((band) => age < band.maxAge) ?? AGE_BANDS[AGE_BANDS.length - 1]).name;
}

/**
 * Derived walking move speed (R20): race base + Agility bonus. 🟡 — encumbrance
 * (pack weight vs carry capacity) and injuries are meant to subtract here too,
 * but there's no consumer yet, so this is display groundwork only.
 */
export function moveSpeed(race: RaceId | null, attributes: Record<AttributeKey, number>): number {
   return raceBody(race).baseMove + Math.floor((attributes.agility ?? 0) / 10);
}

/**
 * Parses body inputs from the creation modal, clamping each to its limit and
 * keeping the current value for anything that doesn't parse — an empty or junk
 * field never wipes the frame.
 */
export function parseBody(raw: Partial<Record<keyof CharacterBody, string>>, current: CharacterBody): CharacterBody {
   return {
      heightCm: clampField('heightCm', raw.heightCm, current.heightCm),
      weightKg: clampField('weightKg', raw.weightKg, current.weightKg),
      age: clampField('age', raw.age, current.age),
   };
}

function clampField(field: keyof CharacterBody, input: string | undefined, fallback: number): number {
   const value = Number.parseFloat((input ?? '').trim());
   if (!Number.isFinite(value))
      return fallback;

   const { min, max } = BODY_LIMITS[field];
   return Math.round(Math.max(min, Math.min(max, value)));
}

function finiteOr(value: number | undefined, fallback: number): number {
   return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
