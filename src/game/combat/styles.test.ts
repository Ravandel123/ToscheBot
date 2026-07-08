import { describe, expect, it } from 'vitest';
import { FIGHTING_STYLES, FIGHTING_STYLE_IDS, fightingStyle, isFightingStyleId, styleEffect, stylesForFamily, type StyleFamily } from './styles.js';
import { pathToRoot } from '../data/skills.js';

// The style catalog is static content (D10) — a bad edit (a style drawing on a
// node outside its family's tree, a nonsense effect) must fail `npm test`, not
// surface as a wrong-tree training credit or a broken exchange.

/** The tree node each family's styles must draw under (D42: an armed style's
 *  node sits inside its GRIP branch, not loose under the melee root). */
const FAMILY_ROOT: Record<StyleFamily, string> = {
   unarmed: 'brawling',
   one_handed: 'one_handed',
   two_handed: 'two_handed',
   ranged: 'ranged',
};

describe('fighting-style catalog', () => {
   it('every style draws on a node under its own family\'s tree', () => {
      for (const id of FIGHTING_STYLE_IDS) {
         const style = FIGHTING_STYLES[id];
         expect(pathToRoot(style.node), `${id} node outside the ${style.family} tree`).toContain(FAMILY_ROOT[style.family]);
      }
   });

   it('keeps every family within the select budget (styles + a None option ≤ 25)', () => {
      for (const family of Object.keys(FAMILY_ROOT) as StyleFamily[])
         expect(stylesForFamily(family).length).toBeLessThanOrEqual(24);
   });

   it('has sane modifiers and effects', () => {
      for (const id of FIGHTING_STYLE_IDS) {
         const style = fightingStyle(id);
         for (const effect of style.effects ?? []) {
            if (effect.kind === 'hamper')
               expect(effect.attackPenalty, `${id} hamper`).toBeGreaterThan(0);
            if (effect.kind === 'riposte') {
               expect(effect.minMargin, `${id} riposte margin`).toBeGreaterThanOrEqual(1);
               expect(effect.damage.min, `${id} riposte damage`).toBeGreaterThan(0);
               expect(effect.damage.max, `${id} riposte damage range`).toBeGreaterThanOrEqual(effect.damage.min);
            }
         }
      }
   });

   it('guards ids read off DB docs / customIds', () => {
      expect(isFightingStyleId('striker')).toBe(true);
      expect(isFightingStyleId('kung_fu')).toBe(false);
   });

   it('looks up an effect by kind, tolerating no style and no effect', () => {
      expect(styleEffect(null, 'hamper')).toBeUndefined();
      expect(styleEffect('striker', 'hamper')).toBeUndefined();
      expect(styleEffect('grappler', 'hamper')?.attackPenalty).toBeGreaterThan(0);
      expect(styleEffect('stonewall', 'riposte')?.minMargin).toBeGreaterThanOrEqual(1);
   });
});
