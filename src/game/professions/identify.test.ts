import { afterEach, describe, expect, it, vi } from 'vitest';
import {
   MISLABEL_CHANCE_PERCENT,
   examineInstance,
   identifyCheck,
   plausibleMislabel,
   rollMislabel,
} from './identify.js';
import { checkTarget, type CheckSubject } from '../checks.js';
import { FORAGABLES } from '../data/foragables.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';
import type { ItemInstance } from '../character/inventory.js';

// Pure identification tests: mock Math.random (the codebase pattern) and pin
// the mislabel plausibility rules — same family, shared look preferred, never
// the item itself. The confident-voice contract is the component's job; here
// we prove the STATE transitions.

afterEach(() => vi.restoreAllMocks());

function subject(value = 25): CheckSubject {
   return {
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, value])) as Record<AttributeKey, number>,
      progression: { skills: {} },
      identity: { race: null },
   };
}

function instance(overrides: Partial<ItemInstance> = {}): ItemInstance {
   return { instanceId: 'x1', itemId: 'ashgill_fungus', quality: 'common', quantity: 1, acquiredAt: new Date(), ...overrides };
}

describe('identifyCheck', () => {
   it('rolls the Identify leaf shifted by the item\'s own recognizability', () => {
      expect(identifyCheck('stingweed')).toEqual({ node: 'identify_forage', modifier: FORAGABLES.stingweed.identifyModifier });
      expect(identifyCheck('ashgill_fungus').modifier).toBeLessThan(identifyCheck('stingweed').modifier ?? 0);
   });
});

describe('plausibleMislabel', () => {
   it('prefers a same-family item sharing the shown look', () => {
      // ashgill shows 'amber_capped' — honeycap is the only other mushroom
      // wearing that look, so the confident mistake is exactly the scary one.
      expect(plausibleMislabel('ashgill_fungus', 'amber_capped')).toBe('honeycap_mushroom');
   });

   it('falls back to any same-family kin when no look is shared, never itself', () => {
      // No other herb wears 'waxy_stemmed', so the pick falls back to family kin.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = plausibleMislabel('silverleaf', 'waxy_stemmed');
      expect(result).not.toBe('silverleaf');
      expect(result && FORAGABLES[result].family).toBe('herb');
   });
});

describe('rollMislabel', () => {
   it('mislabels under the chance threshold and stays honest above it', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue((MISLABEL_CHANCE_PERCENT - 1) / 100);
      expect(rollMislabel('ashgill_fungus', 'amber_capped')).toBe('honeycap_mushroom');

      spy.mockReturnValue((MISLABEL_CHANCE_PERCENT + 1) / 100);
      expect(rollMislabel('ashgill_fungus', 'amber_capped')).toBeNull();
   });
});

describe('examineInstance', () => {
   it('confirms an already-identified find without rolling (nothing to train)', () => {
      const spy = vi.spyOn(Math, 'random');
      expect(examineInstance(subject(), instance())).toEqual({ kind: 'confirmed' });
      expect(spy).not.toHaveBeenCalled();
   });

   it('reveals the truth on a successful roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // d100 = 1, under any target
      const result = examineInstance(subject(), instance({ identified: false, descriptorId: 'amber_capped' }));

      expect(result.kind).toBe('revealed');
      if (result.kind === 'revealed')
         expect(result.target).toBe(checkTarget(subject(), identifyCheck('ashgill_fungus')));
   });

   it('a failed look at an unknown can settle on a confident wrong id', () => {
      // 1st random: the d100 identify roll (0.99 → 100, always a failure);
      // 2nd: the mislabel chance (0 → yes); 3rd: the lookalike pick.
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0);
      const result = examineInstance(subject(), instance({ identified: false, descriptorId: 'amber_capped' }));

      expect(result).toMatchObject({ kind: 'fooled', apparentItemId: 'honeycap_mushroom' });
   });

   it('a failed look at an unknown can also just stay stumped', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.99);
      const result = examineInstance(subject(), instance({ identified: false, descriptorId: 'amber_capped' }));

      expect(result.kind).toBe('stumped');
   });

   it('a failed look at a mislabel keeps the wrong belief (unshaken)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = examineInstance(subject(), instance({ identified: false, descriptorId: 'amber_capped', apparentItemId: 'honeycap_mushroom' }));

      expect(result.kind).toBe('unshaken');
   });

   it('refuses non-foragables (a stale customId, D10 rule 3)', () => {
      expect(examineInstance(subject(), instance({ itemId: 'iron_sword', identified: false })).kind).toBe('not-examinable');
   });
});
