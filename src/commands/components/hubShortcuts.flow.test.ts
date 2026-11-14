import { describe, expect, it, vi } from 'vitest';
import characterHandler from './character.js';
import playHandler from './play.js';
import { freshHubView } from './_hubView.js';
import { accountService } from '../../db/services/accountService.js';
import { characterService } from '../../db/services/characterService.js';
import { fakeButton, fakeClient } from '../../testing/fakeInteraction.js';
import { useTestDb } from '../../testing/memoryDb.js';

// D59: `/play` is the one command a player needs — the hub carries shortcuts
// to the pack, the skills and the fighting style — and the public character
// sheet can be repainted by anyone with its Refresh button.
vi.mock('../../config.js', () => ({ config: { ownerId: 'the-owner' } }));

useTestDb();

const USER = { userId: 'u1', displayName: 'Rav' };

async function activeCharacter(): Promise<string> {
   await accountService.getOrCreate(USER.userId, USER.displayName);
   const character = await characterService.create(USER.userId, { name: 'Bruna', race: 'canid' });
   await accountService.setActiveCharacter(USER.userId, USER.displayName, character._id, fakeClient().locks);
   return character._id;
}

describe('hub shortcuts', () => {
   it('puts the three shortcuts on the hub', async () => {
      const character = (await characterService.get(await activeCharacter()))!;
      const hub = JSON.stringify(await freshHubView(character));

      for (const panel of ['inventory', 'skills', 'style'])
         expect(hub).toContain(`play:open:${panel}`);
   });

   it.each(['inventory', 'skills', 'style'])('turns the hub into the %s panel, which leads back', async (panel) => {
      await activeCharacter();
      const client = fakeClient();
      const open = fakeButton(`play:open:${panel}`, USER);

      await playHandler.handle(client, open.interaction);

      expect(open.captured.replies).toHaveLength(0); // same message, no new one
      const view = JSON.stringify(open.captured.updates.at(-1));
      expect(view).toContain('embeds');
      expect(view).toContain('"custom_id":"play:hub"');

      const back = fakeButton('play:hub', USER);
      await playHandler.handle(client, back.interaction);
      expect(JSON.stringify(back.captured.updates.at(-1))).toContain(`play:open:${panel}`);
   });
});

describe('character sheet refresh', () => {
   it('repaints the sheet from the database, for anyone, with a short cooldown', async () => {
      const characterId = await activeCharacter();
      const client = fakeClient();
      const stranger = { userId: 'someone-else' };

      await characterService.applyCurrencyDeltas(characterId, { deltradaCoins: 42 });
      const first = fakeButton(`character:sheet:${characterId}:metric`, stranger);
      await characterHandler.handle(client, first.interaction);

      const repaint = JSON.stringify(first.captured.updates.at(-1));
      expect(repaint).toContain('42');
      expect(repaint).toContain(`character:sheet:${characterId}:metric`);

      // A second click right away is refused privately; the sheet is untouched.
      const second = fakeButton(`character:sheet:${characterId}:metric`, stranger);
      await characterHandler.handle(client, second.interaction);
      expect(second.captured.updates).toHaveLength(0);
      expect(second.captured.replies).toHaveLength(1);
   });
});
