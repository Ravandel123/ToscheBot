import { describe, expect, it } from 'vitest';
import { BOUT_MODES, DEFAULT_BOUT_MODE, boutMode, selectableBoutModes } from './bouts.js';

describe('bout modes', () => {
   it('the default mode exists and is selectable', () => {
      expect(BOUT_MODES[DEFAULT_BOUT_MODE].selectable).toBe(true);
   });

   it('offers only selectable modes in the picker', () => {
      const ids = selectableBoutModes().map((entry) => entry.id);
      expect(ids).toContain('geared');
      expect(ids).toContain('bare');
      expect(ids).not.toContain('sand_axes'); // future/un-selectable
   });

   it('resolves a known selectable mode', () => {
      expect(boutMode('bare').id).toBe('bare');
      expect(boutMode('bare').loadout).toBe('unarmed-unarmored');
   });

   it('falls back to the default for an unknown or un-selectable id', () => {
      expect(boutMode('does-not-exist').id).toBe(DEFAULT_BOUT_MODE);
      expect(boutMode('sand_axes').id).toBe(DEFAULT_BOUT_MODE); // not selectable yet
   });
});
