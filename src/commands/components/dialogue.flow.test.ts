import { afterEach, describe, expect, it, vi } from 'vitest';
import playHandler from './play.js';
import activityHandler from './activity.js';
import dialogueActivity from './_activities/dialogue.js';
import { accountService } from '../../db/services/accountService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { Character } from '../../db/models/character.js';
import { DIALOGUE_CHECK_AP_COST, dialogueStateFrom } from '../../game/activity/dialogue.js';
import { NPCS, npcCharacterId } from '../../game/data/npcs.js';
import { fakeButton, fakeClient } from '../../testing/fakeInteraction.js';
import { useTestDb } from '../../testing/memoryDb.js';

// Layer-2 flow tests for S4: the whole talk loop (hub click → NPC picker →
// dialogue session → option picks → checks/effects → farewell) against the
// in-memory DB. Randomness is mocked where a check rolls; real Discord
// behaviour stays a manual smoke test.
useTestDb();

afterEach(() => vi.restoreAllMocks());

const USER = { userId: 'u1', displayName: 'Rav' };
const MARREK = npcCharacterId('old_campaigner');

async function readyTalker(location = 'tavern', actionPoints = 5): Promise<string> {
   const client = fakeClient();
   await accountService.getOrCreate(USER.userId, USER.displayName);
   const character = await characterService.create(USER.userId, { name: 'Talker', race: 'canid' });
   await characterService.submitForApproval(character._id);
   await characterService.approve(character._id);
   await characterService.setLocation(character._id, location);
   await Character.updateOne({ _id: character._id }, { $set: { 'actionPoints.current': actionPoints } });
   await accountService.setActiveCharacter(USER.userId, USER.displayName, character._id, client.locks);
   return character._id;
}

async function seedMarrek(location = 'tavern'): Promise<void> {
   const { name, epithet, gender, bio, race } = NPCS.old_campaigner;
   await characterService.createNpc(MARREK, { name, epithet, gender, bio, race }, location);
}

/** Clicks through hub → picker → Marrek, returning the open session's id. */
async function openDialogue(characterId: string): Promise<{ sessionId: string }> {
   const { interaction } = fakeButton(`play:talkto:${MARREK}`, USER);
   await playHandler.handle(fakeClient(), interaction);

   const session = await activitySessionService.getActiveForParticipant(characterId);
   if (!session)
      throw new Error('no dialogue session was opened');
   return { sessionId: session._id };
}

describe('play:act:talk (the picker)', () => {
   it('lists the NPCs standing here as talkto buttons', async () => {
      await readyTalker();
      await seedMarrek();

      const { interaction, captured } = fakeButton('play:act:talk', USER);
      await playHandler.handle(fakeClient(), interaction);

      expect(captured.updates).toHaveLength(1);
      expect(JSON.stringify(captured.updates[0])).toContain(`play:talkto:${MARREK}`);
   });

   it('degrades to a lonely hub banner when nobody talkable is around', async () => {
      const characterId = await readyTalker('riverbank');

      const { interaction, captured } = fakeButton('play:act:talk', USER);
      await playHandler.handle(fakeClient(), interaction);

      expect(captured.updates).toHaveLength(1); // the hub, repainted with the banner
      expect(await activitySessionService.getActiveForParticipant(characterId)).toBeNull();
   });
});

describe('play:talkto (opening the session)', () => {
   it('opens a dialogue session with the PLAYER as the only participant (the NPC is never busy)', async () => {
      const characterId = await readyTalker();
      await seedMarrek();

      const { interaction, captured } = fakeButton(`play:talkto:${MARREK}`, USER);
      await playHandler.handle(fakeClient(), interaction);

      const session = await activitySessionService.getActiveForParticipant(characterId);
      expect(session?.type).toBe('dialogue');
      expect(session?.participantIds).toEqual([characterId]);
      expect(await activitySessionService.getActiveForParticipant(MARREK)).toBeNull();

      const state = dialogueStateFrom(session!.state);
      expect(state.dialogueId).toBe('marrek_tales');
      expect(state.nodeId).toBe('corner');
      // Honest-% discipline: the rolled option's target was precomputed.
      expect(state.optionTargets['corner.scar']).toBeGreaterThanOrEqual(5);
      expect(captured.deferredUpdate).toBe(true);
      expect(JSON.stringify(captured.updates.at(-1))).toContain('activity:opt:');
   });

   it('refuses an NPC standing somewhere else (a stale picker)', async () => {
      const characterId = await readyTalker('plaza');
      await seedMarrek('tavern');

      const { interaction } = fakeButton(`play:talkto:${MARREK}`, USER);
      await playHandler.handle(fakeClient(), interaction);

      expect(await activitySessionService.getActiveForParticipant(characterId)).toBeNull();
   });

   it('re-enters the current step instead of opening a second session', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      const { interaction, captured } = fakeButton(`play:talkto:${MARREK}`, USER);
      await playHandler.handle(fakeClient(), interaction);

      const session = await activitySessionService.getActiveForParticipant(characterId);
      expect(session?._id).toBe(sessionId);
      expect(JSON.stringify(captured.updates.at(-1))).toContain('in the middle of something');
   });
});

describe('activity dialogue steps', () => {
   it('a checkless pick advances to the routed node — free, no training', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      const { interaction, captured } = fakeButton(`activity:opt:${sessionId}:wall`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      const session = await activitySessionService.get(sessionId);
      expect(session?.step).toBe(1);
      expect(dialogueStateFrom(session!.state).nodeId).toBe('wall_years');

      const character = (await characterService.get(characterId))!;
      expect(character.actionPoints.current).toBe(5);
      expect(character.progression.skills.speechcraft).toBeUndefined();
      expect(captured.updates).toHaveLength(1);
   });

   it('a rolled pick spends AP, trains the path and routes on the result (success)', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      vi.spyOn(Math, 'random').mockReturnValue(0); // roll 1 — success, first flavor line
      const { interaction } = fakeButton(`activity:opt:${sessionId}:scar`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      const state = dialogueStateFrom((await activitySessionService.get(sessionId))!.state);
      expect(state.nodeId).toBe('true_story');
      expect(state.flags).toContain('heard_truth');
      expect(state.spentOptionKeys).toContain('corner.scar'); // the one-shot burned

      const character = (await characterService.get(characterId))!;
      expect(character.actionPoints.current).toBe(5 - DIALOGUE_CHECK_AP_COST);
      // Learn-by-doing (D40): the persuade path banked progress.
      expect(character.progression.skills.persuade?.progress ?? 0).toBeGreaterThan(0);
   });

   it('a trait-awarding pick writes the delta to the CHARACTER, not just the snapshot', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      const { interaction } = fakeButton(`activity:opt:${sessionId}:mock`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      const character = (await characterService.get(characterId))!;
      expect(character.traits.cruelty).toBe(1);
      expect(dialogueStateFrom((await activitySessionService.get(sessionId))!.state).traits.cruelty).toBe(1);
   });

   it('refuses a rolled pick without the AP — no roll, no advance', async () => {
      const characterId = await readyTalker('tavern', 0);
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      const { interaction, captured } = fakeButton(`activity:opt:${sessionId}:scar`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      expect((await activitySessionService.get(sessionId))?.step).toBe(0);
      expect((await characterService.get(characterId))!.progression.skills.persuade).toBeUndefined();
      expect(JSON.stringify(captured.updates.at(-1))).toContain('AP');
   });

   it('a gated option gets no button until its trait floor is met', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId: locked } = await openDialogue(characterId);
      const lockedView = JSON.stringify(dialogueActivity.render((await activitySessionService.get(locked))!));
      expect(lockedView).not.toContain(`activity:opt:${locked}:swap`);

      // Earn courage, reopen: the [Courage] line is live now.
      await activitySessionService.abandon(locked);
      await characterService.applyTraitDeltas(characterId, { courage: 1 });
      const { sessionId } = await openDialogue(characterId);
      const openView = JSON.stringify(dialogueActivity.render((await activitySessionService.get(sessionId))!));
      expect(openView).toContain(`activity:opt:${sessionId}:swap`);
   });

   it('an ending pick completes: session gone, hub repainted with the farewell', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      const { interaction, captured } = fakeButton(`activity:opt:${sessionId}:leave`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      expect(await activitySessionService.get(sessionId)).toBeNull();
      expect(await activitySessionService.getActiveForParticipant(characterId)).toBeNull();
      expect(JSON.stringify(captured.updates.at(-1))).toContain('part ways');
   });

   it('walking away abandons the session and returns to the hub', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      const { interaction, captured } = fakeButton(`activity:leave:${sessionId}`, USER);
      await activityHandler.handle(fakeClient(), interaction);

      expect(await activitySessionService.get(sessionId)).toBeNull();
      expect(JSON.stringify(captured.updates.at(-1))).toContain('excuse yourself');
   });

   it('a stale double-click repaints instead of advancing twice', async () => {
      const characterId = await readyTalker();
      await seedMarrek();
      const { sessionId } = await openDialogue(characterId);

      const first = fakeButton(`activity:opt:${sessionId}:wall`, USER);
      await activityHandler.handle(fakeClient(), first.interaction);

      // The replayed click carries the OLD node's button — it no longer matches
      // the authoritative state, so the handler repaints instead of moving.
      const stale = fakeButton(`activity:opt:${sessionId}:wall`, USER);
      await activityHandler.handle(fakeClient(), stale.interaction);

      const session = await activitySessionService.get(sessionId);
      expect(session?.step).toBe(1);
      expect(dialogueStateFrom(session!.state).nodeId).toBe('wall_years');
      expect(stale.captured.updates).toHaveLength(1); // repainted, not errored
   });
});
