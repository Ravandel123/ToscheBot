import { describe, expect, it } from 'vitest';
import { bmi, bmiWeight, celsiusToFahrenheit, cmToImperial, fahrenheitToCelsius, kgToImperial } from './units.js';

describe('temperature', () => {
   it('converts Celsius ↔ Fahrenheit', () => {
      expect(celsiusToFahrenheit(100)).toBe(212);
      expect(celsiusToFahrenheit(0)).toBe(32);
      expect(celsiusToFahrenheit(20)).toBe(68);
      expect(celsiusToFahrenheit(-40)).toBe(-40);

      expect(fahrenheitToCelsius(32)).toBe(0);
      expect(fahrenheitToCelsius(212)).toBe(100);
      expect(fahrenheitToCelsius(68)).toBe(20);
      expect(fahrenheitToCelsius(-40)).toBe(-40);
   });
});

describe('imperial length/weight', () => {
   it('formats cm as feet and inches', () => {
      expect(cmToImperial(180, 0)).toBe("5' 11''");
      expect(cmToImperial(180, 2)).toBe("5' 10.87''");
      expect(cmToImperial(0, 0)).toBe("0' 0''");
   });

   it('formats kg as pounds and ounces', () => {
      expect(kgToImperial(80, 0)).toBe('176 lb 6 oz');
      expect(kgToImperial(0, 0)).toBe('0 lb 0 oz');
   });
});

describe('bmi', () => {
   it('computes BMI to 2 decimals', () => {
      expect(bmi(180, 80)).toBe(24.69);
      expect(bmi(170, 68)).toBe(23.53);
   });

   it('computes the weight for a target BMI at a height', () => {
      expect(bmiWeight(180, 24.99)).toBe(81);
      expect(bmiWeight(180, 18.5)).toBe(60);
   });
});
