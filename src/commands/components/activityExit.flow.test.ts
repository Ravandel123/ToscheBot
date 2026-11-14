import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import activityHandler from './activity.js';
import sessionHandler from './session.js';
import { buildSessionOverview } from './_sessionAdminView.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { initialChallengeState } from '../../game/activity/challenge.js';
import { initialDialogueState } from '../../game/activity/dialogue.js';
import { ENCOUNTERS } from '../../game/data/encounters.js';
import { DIALOGUES } from '../../game/data/dialogues.js';
import { npcCharacterId } from '../../game/data/npcs.js';
import { runMigrations } from '../../scripts/migrations.js';
import { fakeButton, fakeClient, fakeSelect } from '../../testing/fakeInteraction.js';
import { useTestDb } from '../../testing/memoryDb.js';

// D58: a solo session never expires, every step offers an in-character exit
// that applies its consequences exactly once, and the owner can clear a stuck
// session from `h!session`.
vi.mock('../../config.js', () => ({ config: { ownerId: 'the-owner' } }));

useTestDb();

afterEach(() => vi.restoreAllMocks());

const USER = { userId: 'u1', displayName: 'Rav' };

async function traveller(): Promise<string> {
   const character = await characterService.create(USER.userId, { name: 'Walker', race: 'canid' });
   await characterService.setLocation(character._id, 'plaza');
   return character._id;
}

async function openChallenge(characterId: string, encounterId: 'drowning_stranger' | 'fallen_tree'): Promise<string> {
   const session = await activitySessionService.create('challenge', [characterId], {
      ...initialChallengeState(encounterId, 'plaza', 'riverbank', {}),
   });
   return session._id;
}

describe('a challenge exit', () => {
   it('ends the session at the origin and applies the exit consequence once', async () => {
      const characterId = await traveller();
      const sessionId = await openChallenge(characterId, 'drowning_stranger');

      const first = fakeButton(`activity:retreat:${sessionId}`, USER);
      await activityHandler.handle(fakeClient(), first.interaction);

      const after = (await characterService.get(characterId))!;
      expect(after.locationId).toBe('plaza');
      expect(after.traits.cowardice).toBe(ENCOUNTERS.drowning_stranger.exit.traits.cowardice);
      expect(await activitySessionService.getActiveForParticipant(characterId)).toBeNull();

      // A second click on the same (now stale) button charges nothing more.
      const second = fakeButton(`activity:retreat:${sessionId}`, USER);
      await activityHandler.handle(fakeClient(), second.interaction);
      expect((await characterService.get(characterId))!.traits.cowardice).toBe(1);
   });

   it('labels the button with the encounter\'s own exit, never a generic cancel', async () => {
      const characterId = await traveller();
      const sessionId = await openChallenge(characterId, 'fallen_tree');
      const session = (await activitySessionService.get(sessionId))!;

      // A stale option id makes the handler repaint the current step.
      const { interaction, captured } = fakeButton(`activity:opt:${session._id}:no-such-option`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      expect(JSON.stringify(captured.updates.at(-1))).toContain(ENCOUNTERS.fallen_tree.exit.label);
   });

   it('does not turn an already-won crossing into a retreat', async () => {
      const characterId = await traveller();
      const session = await activitySessionService.create('challenge', [characterId], {
         ...initialChallengeState('drowning_stranger', 'plaza', 'riverbank', {}),
         resolution: 'proceed',
      });

      const { interaction } = fakeButton(`activity:retreat:${session._id}`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      const after = (await characterService.get(characterId))!;
      expect(after.locationId).toBe('riverbank');
      expect(after.traits.cowardice).toBe(0);
   });
});

describe('a dialogue exit', () => {
   it('cuts the talk off with the dialogue\'s own line', async () => {
      const characterId = await traveller();
      const session = await activitySessionService.create('dialogue', [characterId], {
         ...initialDialogueState('marrek_tales', npcCharacterId('old_campaigner'), DIALOGUES.marrek_tales.start, {}, {}),
      });

      const { interaction, captured } = fakeButton(`activity:leave:${session._id}`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      expect(await activitySessionService.getActiveForParticipant(characterId)).toBeNull();
      expect(JSON.stringify(captured.updates.at(-1))).toContain('windbag');
   });
});

describe('sessions never expire', () => {
   it('keeps a character busy however old the session is', async () => {
      const characterId = await traveller();
      const sessionId = await openChallenge(characterId, 'fallen_tree');
      await mongoose.connection.db!.collection<{ _id: string }>('activitysessions')
         .updateOne({ _id: sessionId }, { $set: { createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01') } });

      expect((await activitySessionService.getActiveForParticipant(characterId))?._id).toBe(sessionId);
      expect(await activitySessionService.activeParticipantIds()).toContain(characterId);
   });

   it('migration drops the old TTL index and expiresAt, and reruns as a no-op', async () => {
      const sessions = mongoose.connection.db!.collection<{ _id: string } & Record<string, unknown>>('activitysessions');
      await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await sessions.insertOne({ _id: 'legacy', type: 'challenge', participantIds: ['c1'], step: 0, status: 'active', state: {}, expiresAt: new Date('2020-01-01') });

      expect((await runMigrations()).modified).toBe(1);

      expect(await sessions.findOne({ _id: 'legacy' })).not.toHaveProperty('expiresAt');
      expect((await sessions.indexes()).some((index) => index.expireAfterSeconds !== undefined)).toBe(false);
      expect((await runMigrations()).modified).toBe(0);
   });
});

describe('h!session (owner overview)', () => {
   it('lists unfinished activities by name', async () => {
      const characterId = await traveller();
      await openChallenge(characterId, 'fallen_tree');

      const overview = JSON.stringify(await buildSessionOverview());
      expect(overview).toContain('Walker');
      expect(overview).toContain(ENCOUNTERS.fallen_tree.name);
   });

   it('refuses anyone but the owner', async () => {
      const characterId = await traveller();
      const sessionId = await openChallenge(characterId, 'fallen_tree');

      const { interaction, captured } = fakeSelect('session:end', [sessionId], USER);
      await sessionHandler.handle(fakeClient(), interaction);

      expect(captured.replies).toHaveLength(1);
      expect(await activitySessionService.getActiveForParticipant(characterId)).not.toBeNull();
   });

   it('lets the owner end a session without the exit consequences', async () => {
      const characterId = await traveller();
      const sessionId = await openChallenge(characterId, 'drowning_stranger');

      const { interaction, captured } = fakeSelect('session:end', [sessionId], { userId: 'the-owner' });
      await sessionHandler.handle(fakeClient(), interaction);

      expect(await activitySessionService.getActiveForParticipant(characterId)).toBeNull();
      expect((await characterService.get(characterId))!.traits.cowardice).toBe(0);
      expect(JSON.stringify(captured.updates.at(-1))).toContain('Ended');
   });
});
