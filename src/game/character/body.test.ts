import { describe, expect, it } from 'vitest';
import { ageBandName, bodyOf, bodyShapeName, defaultBody, moveSpeed, parseBody, type CharacterBody } from './body.js';
import { DEFAULT_AGE, RACE_BODY } from '../data/body.js';
import type { AttributeKey } from '../data/attributes.js';

const attrs = (agility: number): Record<AttributeKey, number> => ({ agility } as Record<AttributeKey, number>);

describe('defaultBody', () => {
   it('uses the midpoint of a race frame + default age', () => {
      const body = defaultBody('canid');
      const [hMin, hMax] = RACE_BODY.canid.heightCm;
      const [wMin, wMax] = RACE_BODY.canid.weightKg;
      expect(body.heightCm).toBe(Math.round((hMin + hMax) / 2));
      expect(body.weightKg).toBe(Math.round((wMin + wMax) / 2));
      expect(body.age).toBe(DEFAULT_AGE);
   });

   it('falls back to a neutral frame for a raceless draft', () => {
      const body = defaultBody(null);
      expect(body.heightCm).toBeGreaterThan(0);
      expect(body.weightKg).toBeGreaterThan(0);
   });
});

describe('bodyShapeName', () => {
   it('bands by BMI', () => {
      expect(bodyShapeName({ heightCm: 180, weightKg: 40, age: 20 })).toBe('gaunt'); // ~12
      expect(bodyShapeName({ heightCm: 170, weightKg: 55, age: 20 })).toBe('lean'); // ~19
      expect(bodyShapeName({ heightCm: 170, weightKg: 70, age: 20 })).toBe('average'); // ~24
      expect(bodyShapeName({ heightCm: 170, weightKg: 85, age: 20 })).toBe('stocky'); // ~29
      expect(bodyShapeName({ heightCm: 160, weightKg: 100, age: 20 })).toBe('heavy'); // ~39
   });
});

describe('ageBandName', () => {
   it('splits young/prime/old', () => {
      expect(ageBandName(10)).toBe('young');
      expect(ageBandName(18)).toBe('prime'); // boundary belongs to the next band
      expect(ageBandName(30)).toBe('prime');
      expect(ageBandName(46)).toBe('old');
      expect(ageBandName(200)).toBe('old');
   });
});

describe('parseBody', () => {
   const current: CharacterBody = { heightCm: 170, weightKg: 70, age: 30 };

   it('parses valid inputs and rounds', () => {
      const body = parseBody({ heightCm: '182', weightKg: '75.6', age: '41' }, current);
      expect(body).toEqual({ heightCm: 182, weightKg: 76, age: 41 });
   });

   it('keeps the current value for empty or junk fields', () => {
      const body = parseBody({ heightCm: '', weightKg: 'abc', age: '   ' }, current);
      expect(body).toEqual(current);
   });

   it('clamps to the field limits', () => {
      const body = parseBody({ heightCm: '9999', weightKg: '0', age: '99999' }, current);
      expect(body.heightCm).toBe(260); // heightCm max
      expect(body.weightKg).toBe(10); // weightKg min
      expect(body.age).toBe(500); // age max
   });
});

describe('bodyOf', () => {
   it('fills missing fields from the race default', () => {
      const filled = bodyOf({ body: { heightCm: 190 }, identity: { race: 'canid' } });
      expect(filled.heightCm).toBe(190); // kept
      expect(filled.weightKg).toBe(defaultBody('canid').weightKg); // filled
      expect(filled.age).toBe(DEFAULT_AGE); // filled
   });

   it('returns the full race default when body is absent (pre-R20 doc)', () => {
      expect(bodyOf({ identity: { race: 'tamian' } })).toEqual(defaultBody('tamian'));
   });
});

describe('moveSpeed', () => {
   it('is race base move + Agility bonus', () => {
      expect(moveSpeed('canid', attrs(20))).toBe(RACE_BODY.canid.baseMove + 2);
      expect(moveSpeed('lutren', attrs(45))).toBe(RACE_BODY.lutren.baseMove + 4);
   });
});
