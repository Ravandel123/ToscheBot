// The Spire-ladder browser is stateless: prev/next ride the index in the customId,
// and the Fight button must be live ONLY for a climb (the next unbeaten rung) or an
// earned rematch — never for a locked champion further up the ladder. These assert
// that gating + the nav clamps, so a bad index can't crash the panel (the failure
// the interface replaced).
import { ComponentType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { buildTrialBrowser } from './_trialView.js';
import { LADDER_LENGTH, SPIRE_LADDER } from '../../game/combat/spireLadder.js';

function fightButton(clearedRung: number, index: number) {
   const rows = buildTrialBrowser(clearedRung, index).components.map((row) => row.toJSON());
   const buttons = rows.flatMap((row) => row.components).filter((c) => c.type === ComponentType.Button);
   const fight = buttons.find((b) => 'custom_id' in b && b.custom_id?.startsWith('trial:fight:'));
   if (!fight || !('custom_id' in fight))
      throw new Error('no fight button rendered');
   return fight;
}

describe('buildTrialBrowser fight gating', () => {
   it('enables the Fight button on the next unbeaten rung (a climb)', () => {
      const fight = fightButton(2, 2);
      expect(fight.disabled).toBe(false);
      expect(fight.custom_id).toBe(`trial:fight:${SPIRE_LADDER[2].id}`);
   });

   it('enables the Fight button on an already-cleared champion (a rematch)', () => {
      const fight = fightButton(3, 1);
      expect(fight.disabled).toBe(false);
   });

   it('disables the Fight button on a locked champion further up the ladder', () => {
      const fight = fightButton(1, 5);
      expect(fight.disabled).toBe(true);
   });
});

describe('buildTrialBrowser nav clamps', () => {
   it('clamps a negative / overshoot index into range without throwing', () => {
      expect(() => buildTrialBrowser(0, -3)).not.toThrow();
      expect(() => buildTrialBrowser(0, LADDER_LENGTH + 10)).not.toThrow();
      expect(() => buildTrialBrowser(0, Number.NaN)).not.toThrow();
   });

   it('disables prev at the first rung and next at the last', () => {
      const firstRow = buildTrialBrowser(0, 0).components[0].toJSON();
      const prev = firstRow.components[0];
      expect(prev.type === ComponentType.Button && prev.disabled).toBe(true);

      const lastRow = buildTrialBrowser(0, LADDER_LENGTH - 1).components[0].toJSON();
      const next = lastRow.components[2];
      expect(next.type === ComponentType.Button && next.disabled).toBe(true);
   });
});
