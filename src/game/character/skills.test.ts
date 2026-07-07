import { describe, expect, it } from 'vitest';
import {
   attributeTerm,
   creditUse,
   effectiveSkill,
   emptyProgression,
   nodePoints,
   pathNodeSet,
   skillSum,
   usesForNextPoint,
   type SkillProgression,
} from './skills.js';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';
import { SKILL_NODE_CAP, type SkillNodeId } from '../data/skills.js';

/** All eight attributes at one value (override individual ones as needed). */
function attrs(value = 20, overrides: Partial<Record<AttributeKey, number>> = {}): Record<AttributeKey, number> {
   return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, overrides[k] ?? value])) as Record<AttributeKey, number>;
}

/** A sparse progression from a `{ nodeId: points }` shorthand. */
function prog(points: Partial<Record<SkillNodeId, number>>): SkillProgression {
   return Object.fromEntries(Object.entries(points).map(([id, p]) => [id, { points: p, progress: 0 }]));
}

describe('sums along the tree', () => {
   it('reads an untrained node as 0', () => {
      expect(nodePoints({}, 'smithing')).toBe(0);
      expect(nodePoints(prog({ smithing: 7 }), 'smithing')).toBe(7);
   });

   it('dedupes shared ancestors across paths', () => {
      expect(pathNodeSet(['bladesmithing', 'axesmithing'])).toEqual(
         expect.arrayContaining(['bladesmithing', 'axesmithing', 'weaponsmithing', 'smithing']),
      );
      expect(pathNodeSet(['bladesmithing', 'axesmithing'])).toHaveLength(4); // parents counted once
   });

   it('sums the unique path nodes only once', () => {
      const p = prog({ smithing: 5, weaponsmithing: 10, bladesmithing: 3, axesmithing: 2 });
      expect(skillSum(p, ['bladesmithing', 'axesmithing'])).toBe(5 + 10 + 3 + 2);
   });
});

describe('attribute blend', () => {
   it('applies a single-attribute blend', () => {
      expect(attributeTerm(attrs(40), 'persuade')).toBe(0.5 * 40); // pure charisma
   });

   it('blends two attributes (the owner\'s Intimidate example)', () => {
      // 50% charisma + 50% strength, each at weight 0.25.
      expect(attributeTerm(attrs(40), 'intimidate')).toBe(0.25 * 40 + 0.25 * 40);
      // Reconfiguring what it depends on changes the term — strength alone moves it.
      expect(attributeTerm(attrs(40, { strength: 80 }), 'intimidate')).toBe(0.25 * 40 + 0.25 * 80);
   });
});

describe('effectiveSkill (the worked longsword)', () => {
   // A smith with the owner's example spread, all attributes at 20.
   const smith = prog({ smithing: 5, weaponsmithing: 10, bladesmithing: 15, iron_metallurgy: 5 });

   it('sums the primary path + the attribute term', () => {
      // blend (inherited Smithing) = 0.2 INT + 0.1 DEX = 6; path = 15+10+5 = 30.
      expect(effectiveSkill(attrs(20), smith, { node: 'bladesmithing' })).toBe(6 + 30);
   });

   it('also sums a material cross-path (iron metallurgy)', () => {
      // + iron_metallurgy (5) + metallurgy (0).
      expect(effectiveSkill(attrs(20), smith, { node: 'bladesmithing', extraNodes: ['iron_metallurgy'] })).toBe(6 + 30 + 5);
   });

   it('a generalist (Smithing only) still bangs out basics, worse than a specialist', () => {
      const generalist = prog({ smithing: 30 });
      const specialist = prog({ smithing: 5, weaponsmithing: 10, bladesmithing: 15 });
      expect(effectiveSkill(attrs(20), generalist, { node: 'bladesmithing' })).toBe(6 + 30);
      expect(effectiveSkill(attrs(20), specialist, { node: 'bladesmithing' })).toBe(6 + 30);
      // Same sum here by construction — but the specialist's is concentrated in
      // the leaf, which is what an item's Required Sum will gate on (future).
      expect(nodePoints(specialist, 'bladesmithing')).toBeGreaterThan(nodePoints(generalist, 'bladesmithing'));
   });
});

describe('growth bands', () => {
   it('costs more uses per point as a node rises (diminishing returns)', () => {
      expect(usesForNextPoint('smithing', 0)).toBe(10); // root 1-5
      expect(usesForNextPoint('smithing', 5)).toBe(50); // root 5-10
      expect(usesForNextPoint('bladesmithing', 0)).toBe(5); // leaf 1-5
      expect(usesForNextPoint('bladesmithing', 5)).toBe(20); // leaf 5-10
   });

   it('is Infinity at the cap (ordinary practice stops)', () => {
      expect(usesForNextPoint('smithing', SKILL_NODE_CAP)).toBe(Infinity);
   });
});

describe('creditUse (learn-by-doing)', () => {
   it('credits every node on the path, leaf fastest', () => {
      let p: SkillProgression = emptyProgression().skills;
      for (let i = 0; i < 5; i++)
         p = creditUse(p, ['bladesmithing']).progression;

      // 5 uses: the leaf (5/pt) ticks to 1; the branch (10/pt) and root (10/pt) do not yet.
      expect(nodePoints(p, 'bladesmithing')).toBe(1);
      expect(nodePoints(p, 'weaponsmithing')).toBe(0);
      expect(nodePoints(p, 'smithing')).toBe(0);
      // and the untouched rest of the tree stays absent (sparse).
      expect(Object.keys(p).sort()).toEqual(['bladesmithing', 'smithing', 'weaponsmithing']);
   });

   it('reports the nodes that ranked up', () => {
      let p: SkillProgression = {};
      for (let i = 0; i < 4; i++)
         p = creditUse(p, ['bladesmithing']).progression;

      const fifth = creditUse(p, ['bladesmithing']);
      expect(fifth.levelUps).toEqual([{ node: 'bladesmithing', from: 0, to: 1 }]);
   });

   it('does not mutate the input map', () => {
      const before: SkillProgression = { smithing: { points: 0, progress: 0 } };
      creditUse(before, ['smithing']);
      expect(before.smithing).toEqual({ points: 0, progress: 0 });
   });

   it('holds at the cap and stops hoarding progress', () => {
      const capped: SkillProgression = { smithing: { points: SKILL_NODE_CAP, progress: 999 } };
      const result = creditUse(capped, ['smithing']); // smithing is a root — path is itself only
      expect(result.progression.smithing).toEqual({ points: SKILL_NODE_CAP, progress: 0 });
      expect(result.levelUps).toEqual([]);
   });
});

describe('creditUse training weights (D40)', () => {
   it('banks a fractional weight, rounded to 2 decimals (no float dust)', () => {
      const first = creditUse({}, ['bladesmithing'], 1.5);
      expect(first.progression.bladesmithing).toEqual({ points: 0, progress: 1.5 });

      const second = creditUse(first.progression, ['bladesmithing'], 0.33);
      expect(second.progression.bladesmithing?.progress).toBe(1.83);
   });

   it('a zero or negative weight is a pure no-op (a pushover teaches nothing)', () => {
      const before: SkillProgression = { smithing: { points: 1, progress: 2 } };
      expect(creditUse(before, ['smithing'], 0)).toEqual({ progression: before, levelUps: [] });
      expect(creditUse(before, ['smithing'], -0.5)).toEqual({ progression: before, levelUps: [] });
   });

   it('heavier uses reach a point in fewer actions', () => {
      // Leaf band below 5 points needs 5 uses: 2 + 2 + 1 lands the point on the
      // third action instead of the fifth.
      let p: SkillProgression = creditUse({}, ['bladesmithing'], 2).progression;
      p = creditUse(p, ['bladesmithing'], 2).progression;
      const third = creditUse(p, ['bladesmithing'], 1);

      expect(third.levelUps).toContainEqual({ node: 'bladesmithing', from: 0, to: 1 });
      expect(third.progression.bladesmithing).toEqual({ points: 1, progress: 0 });
   });

   it('carries fractional remainder across a rank-up', () => {
      const almost: SkillProgression = { bladesmithing: { points: 0, progress: 4.6 } };
      const result = creditUse(almost, ['bladesmithing'], 1.5); // 6.1 = 5 (point) + 1.1 over
      expect(result.progression.bladesmithing).toEqual({ points: 1, progress: 1.1 });
   });
});
