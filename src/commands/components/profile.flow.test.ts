import { describe, expect, it } from 'vitest';
import profileHandler from './profile.js';
import { accountService } from '../../db/services/accountService.js';
import { fakeButton, fakeClient, fakeModalSubmit } from '../../testing/fakeInteraction.js';
import { useTestDb } from '../../testing/memoryDb.js';

// Layer-2 flow test: drive the `profile` component handler with fake button /
// modal interactions and assert the whole loop — the handler reads settings,
// writes through accountService to the in-memory DB, and repaints the panel.
// This is the pattern the docs point future handler tests at.
useTestDb();

const USER = { userId: 'u1', displayName: 'Ravandel' };

// The panel that surfaces these controls calls getOrCreate first; simulate that
// so the account exists before a toggle (updateSetting doesn't upsert).
async function openedPanel() {
   await accountService.getOrCreate(USER.userId, USER.displayName);
}

describe('profile handler — boolean toggle', () => {
   it('flips a default-ON setting off and persists it, repainting the panel', async () => {
      await openedPanel();
      const { interaction, captured } = fakeButton('profile:toggle:activeGame', USER);

      await profileHandler.handle(fakeClient(), interaction);

      expect((await accountService.getSettings(USER.userId)).activeGame).toBe(false);
      expect(captured.updates).toHaveLength(1); // panel repainted in place
      expect(captured.replies).toHaveLength(0);
   });

   it('toggling twice returns to the original value', async () => {
      await openedPanel();

      await profileHandler.handle(fakeClient(), fakeButton('profile:toggle:activeGame', USER).interaction);
      await profileHandler.handle(fakeClient(), fakeButton('profile:toggle:activeGame', USER).interaction);

      expect((await accountService.getSettings(USER.userId)).activeGame).toBe(true);
   });

   it('a retired toggle key is refused without a write', async () => {
      await openedPanel();
      const { interaction, captured } = fakeButton('profile:toggle:nonsense', USER);

      await profileHandler.handle(fakeClient(), interaction);

      expect(captured.replies).toHaveLength(1); // "that switch no longer exists"
      expect(captured.updates).toHaveLength(0);
   });
});

describe('profile handler — units cycle', () => {
   it('cycles metric → imperial and persists', async () => {
      await openedPanel();

      await profileHandler.handle(fakeClient(), fakeButton('profile:units', USER).interaction);

      expect((await accountService.getSettings(USER.userId)).units).toBe('imperial');
   });
});

describe('profile handler — timezone modal', () => {
   it('accepts a valid IANA zone and persists it', async () => {
      await openedPanel();
      const { interaction, captured } = fakeModalSubmit('profile:set-timezone', { value: 'Europe/Warsaw' }, USER);

      await profileHandler.handle(fakeClient(), interaction);

      expect((await accountService.getSettings(USER.userId)).timezone).toBe('Europe/Warsaw');
      expect(captured.updates).toHaveLength(1); // repainted from the modal
   });

   it('rejects an unknown zone without touching the setting', async () => {
      await openedPanel();
      const { interaction, captured } = fakeModalSubmit('profile:set-timezone', { value: 'Nowhere/Bogus' }, USER);

      await profileHandler.handle(fakeClient(), interaction);

      expect((await accountService.getSettings(USER.userId)).timezone).toBeNull();
      expect(captured.replies).toHaveLength(1); // the "isn't a timezone I know" error
      expect(captured.updates).toHaveLength(0);
   });
});

describe('profile handler — opening a modal', () => {
   it('shows the country modal on the Set country button', async () => {
      await openedPanel();
      const { interaction, captured } = fakeButton('profile:country', USER);

      await profileHandler.handle(fakeClient(), interaction);

      expect(captured.modals).toHaveLength(1);
   });
});
