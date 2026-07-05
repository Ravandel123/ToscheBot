import { describe, expect, it } from 'vitest';
import {
   SKILL_NODES,
   SKILL_NODE_IDS,
   SKILL_NODE_CAP,
   growthProfileFor,
   isSkillNodeId,
   pathToRoot,
   resolveBlend,
} from './skills.js';
import { ATTRIBUTE_KEYS } from './attributes.js';

// The tree is static content (D10) — a bad edit (dangling parent, a cycle, a
// node with no governing attribute anywhere up its path) must fail `npm test`,
// not surface as a runtime NaN or a hang.

describe('skill tree catalog', () => {
   it('every parent is null or an existing node', () => {
      for (const id of SKILL_NODE_IDS) {
         const parent = SKILL_NODES[id].parent;
         if (parent !== null)
            expect(isSkillNodeId(parent), `${id} → ${parent}`).toBe(true);
      }
   });

   it('every node reaches a root with no cycle', () => {
      for (const id of SKILL_NODE_IDS) {
         const path = pathToRoot(id);
         expect(new Set(path).size, `${id} path has a cycle`).toBe(path.length);
         expect(SKILL_NODES[path[path.length - 1]].parent, `${id} path does not end at a root`).toBeNull();
      }
   });

   it('every node resolves to a non-empty attribute blend', () => {
      for (const id of SKILL_NODE_IDS) {
         const blend = resolveBlend(id);
         expect(Object.keys(blend).length, `${id} has no governing attribute`).toBeGreaterThan(0);
         for (const [attr, weight] of Object.entries(blend)) {
            expect(ATTRIBUTE_KEYS, `${id} blends unknown attribute ${attr}`).toContain(attr);
            expect(weight, `${id} weight on ${attr}`).toBeGreaterThan(0);
         }
      }
   });

   it('every growth profile has ascending bands reaching the cap', () => {
      for (const id of SKILL_NODE_IDS) {
         const bands = growthProfileFor(id).bands;
         for (let i = 1; i < bands.length; i++)
            expect(bands[i].upTo, `${id} bands not ascending`).toBeGreaterThan(bands[i - 1].upTo);
         expect(bands[bands.length - 1].upTo, `${id} last band short of cap`).toBeGreaterThanOrEqual(SKILL_NODE_CAP);
         for (const band of bands)
            expect(band.usesPerPoint, `${id} non-positive uses`).toBeGreaterThan(0);
      }
   });
});

describe('tree helpers', () => {
   it('walks a leaf up to its root', () => {
      expect(pathToRoot('bladesmithing')).toEqual(['bladesmithing', 'weaponsmithing', 'smithing']);
   });

   it('inherits the attribute blend from the nearest ancestor', () => {
      // Bladesmithing declares none → inherits Smithing's blend.
      expect(resolveBlend('bladesmithing')).toEqual(SKILL_NODES.smithing.attributes);
   });

   it('lets a node override its inherited blend', () => {
      // The owner's example: Intimidate is half charisma, half strength.
      expect(resolveBlend('intimidate')).toEqual({ charisma: 0.25, strength: 0.25 });
      expect(resolveBlend('persuade')).toEqual({ charisma: 0.5 }); // sibling inherits pure CHA
   });

   it('defaults the growth tier by depth when unspecified', () => {
      expect(growthProfileFor('smithing')).toBe(growthProfileFor('metallurgy')); // roots
      expect(growthProfileFor('bladesmithing').bands[0].usesPerPoint).toBe(5); // leaf, fast
      expect(growthProfileFor('smithing').bands[0].usesPerPoint).toBe(10); // root, slow
   });
});
