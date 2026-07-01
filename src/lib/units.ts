import { roundTo } from './number.js';

// Pure unit conversions, ported from the old `common.js` calc helpers. No Discord,
// no flavour — generic enough to live in lib/ and be reused anywhere.

const INCHES_PER_CM = 0.39370078740157;
const OUNCES_PER_KG = 35.27396194958;

export const celsiusToFahrenheit = (celsius: number): number => (celsius * 9) / 5 + 32;
export const fahrenheitToCelsius = (fahrenheit: number): number => ((fahrenheit - 32) * 5) / 9;

/** Centimetres → `"5' 11''"` (feet + leftover inches, rounded to `decimals`). */
export function cmToImperial(centimetres: number, decimals = 0): string {
   const totalInches = centimetres * INCHES_PER_CM;
   const feet = Math.floor(totalInches / 12);
   const inches = roundTo(totalInches % 12, decimals);
   return `${feet}' ${inches}''`;
}

/** Kilograms → `"176 lb 6 oz"` (pounds + leftover ounces, rounded to `decimals`). */
export function kgToImperial(kilograms: number, decimals = 0): string {
   const totalOunces = kilograms * OUNCES_PER_KG;
   const pounds = Math.floor(totalOunces / 16);
   const ounces = roundTo(totalOunces % 16, decimals);
   return `${pounds} lb ${ounces} oz`;
}

/** Body Mass Index from height (cm) and weight (kg), to 2 decimals. */
export function bmi(heightCm: number, weightKg: number): number {
   const heightM = heightCm / 100;
   return roundTo(weightKg / (heightM * heightM), 2);
}

/** The (rounded) weight in kg that yields `targetBmi` at `heightCm`. */
export function bmiWeight(heightCm: number, targetBmi: number): number {
   const heightM = heightCm / 100;
   return Math.round(heightM * heightM * targetBmi);
}
