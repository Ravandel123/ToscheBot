import { describe, expect, it } from 'vitest';
import { MAX_PLAN_RULES, activePlanStyle, describeTrigger, emptyFamilyPlan, sanitizeFamilyPlan, type FamilyPlan, type PlanContext } from './plan.js';

const fresh: PlanContext = { round: 1, selfHealthPercent: 100, foeHealthPercent: 100 };

describe('activePlanStyle', () => {
   it('returns the default style when no rule fires', () => {
      const plan: FamilyPlan = { style: 'striker', rules: [{ trigger: { kind: 'self-health-below', value: 50 }, style: 'stonewall' }] };
      expect(activePlanStyle(plan, fresh)).toBe('striker');
      expect(activePlanStyle(emptyFamilyPlan(), fresh)).toBeNull();
   });

   it('fires each trigger kind on its own condition', () => {
      const stonewallAt50: FamilyPlan = { style: null, rules: [{ trigger: { kind: 'self-health-below', value: 50 }, style: 'stonewall' }] };
      expect(activePlanStyle(stonewallAt50, { ...fresh, selfHealthPercent: 49 })).toBe('stonewall');
      expect(activePlanStyle(stonewallAt50, { ...fresh, selfHealthPercent: 50 })).toBeNull(); // strict below

      const finishThem: FamilyPlan = { style: null, rules: [{ trigger: { kind: 'foe-health-below', value: 40 }, style: 'striker' }] };
      expect(activePlanStyle(finishThem, { ...fresh, foeHealthPercent: 39 })).toBe('striker');
      expect(activePlanStyle(finishThem, fresh)).toBeNull();

      const lateGame: FamilyPlan = { style: null, rules: [{ trigger: { kind: 'round-at-least', value: 5 }, style: 'grappler' }] };
      expect(activePlanStyle(lateGame, { ...fresh, round: 5 })).toBe('grappler'); // inclusive
      expect(activePlanStyle(lateGame, { ...fresh, round: 4 })).toBeNull();
   });

   it('gives the FIRST matching rule priority (list order)', () => {
      const plan: FamilyPlan = {
         style: 'striker',
         rules: [
            { trigger: { kind: 'self-health-below', value: 25 }, style: 'stonewall' },
            { trigger: { kind: 'self-health-below', value: 60 }, style: 'grappler' },
         ],
      };
      expect(activePlanStyle(plan, { ...fresh, selfHealthPercent: 50 })).toBe('grappler');
      expect(activePlanStyle(plan, { ...fresh, selfHealthPercent: 20 })).toBe('stonewall'); // both fire → first wins
   });
});

describe('sanitizeFamilyPlan', () => {
   it('passes a valid plan through unchanged', () => {
      const plan: FamilyPlan = { style: 'grappler', rules: [{ trigger: { kind: 'round-at-least', value: 3 }, style: 'striker' }] };
      expect(sanitizeFamilyPlan(plan, 'unarmed')).toEqual(plan);
   });

   it('degrades junk shapes to the empty plan', () => {
      expect(sanitizeFamilyPlan(undefined, 'unarmed')).toEqual(emptyFamilyPlan());
      expect(sanitizeFamilyPlan('what', 'unarmed')).toEqual(emptyFamilyPlan());
      expect(sanitizeFamilyPlan({ style: 42, rules: 'no' }, 'unarmed')).toEqual(emptyFamilyPlan());
   });

   it('drops unknown and wrong-family styles (D10 rule 3)', () => {
      // A melee style stored under unarmed (or a renamed style) must never fight.
      const plan = { style: 'warden', rules: [{ trigger: { kind: 'round-at-least', value: 3 }, style: 'gone_style' }] };
      expect(sanitizeFamilyPlan(plan, 'unarmed')).toEqual(emptyFamilyPlan());
      expect(sanitizeFamilyPlan(plan, 'melee').style).toBe('warden');
   });

   it('clamps trigger values and caps the rule count', () => {
      const rules = [
         { trigger: { kind: 'self-health-below', value: 250 }, style: 'striker' },
         { trigger: { kind: 'round-at-least', value: -3 }, style: 'grappler' },
         { trigger: { kind: 'foe-health-below', value: 50 }, style: 'stonewall' },
         { trigger: { kind: 'foe-health-below', value: 25 }, style: 'stonewall' },
      ];
      const clean = sanitizeFamilyPlan({ style: null, rules }, 'unarmed');

      expect(clean.rules).toHaveLength(MAX_PLAN_RULES);
      expect(clean.rules[0].trigger.value).toBe(99);
      expect(clean.rules[1].trigger.value).toBe(1);
   });
});

describe('describeTrigger', () => {
   it('renders each kind as a human line', () => {
      expect(describeTrigger({ kind: 'self-health-below', value: 50 })).toBe('my Health below 50%');
      expect(describeTrigger({ kind: 'foe-health-below', value: 25 })).toBe("foe's Health below 25%");
      expect(describeTrigger({ kind: 'round-at-least', value: 5 })).toBe('from round 5');
   });
});
