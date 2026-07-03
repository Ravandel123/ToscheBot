import { describe, expect, it } from 'vitest';
import {
   appliedOutcome,
   attemptChallenge,
   availableOptions,
   challengeProgress,
   challengeStateFrom,
   initialChallengeState,
   type ChallengeState,
} from './challenge.js';
import type { ChallengeOption } from '../data/encounters.js';

const MAX_SETBACKS = 2;

const checked: ChallengeOption = {
   id: 'climb',
   label: 'Climb',
   emoji: '🧗',
   description: 'Up and over.',
   check: { attribute: 'agility' },
   success: { result: 'proceed', lines: ['Over you go.'] },
   failure: { result: 'retry', lines: ['You slip.'] },
};

const oneShot: ChallengeOption = {
   ...checked,
   id: 'search',
   oneShot: true,
};

const ignore: ChallengeOption = {
   id: 'ignore',
   label: 'Walk on',
   emoji: '🚶',
   description: 'Not your problem.',
   success: { result: 'proceed', lines: ['You walk on.'], traits: { cowardice: 1 } },
};

const giveUp: ChallengeOption = {
   ...checked,
   id: 'give-up',
   failure: { result: 'turn-back', lines: ['It defeats you.'] },
};

const fresh = (): ChallengeState => initialChallengeState('fallen_tree', 'plaza', 'tavern', { climb: 40 });

describe('attemptChallenge', () => {
   it('resolves as proceed on a successful check', () => {
      const next = attemptChallenge(fresh(), checked, true, 'Over you go.', MAX_SETBACKS);
      expect(challengeProgress(next)).toBe('proceed');
      expect(next.lastLine).toBe('Over you go.');
      expect(next.setbacks).toBe(0);
   });

   it('counts a failed retry as a setback and stays ongoing', () => {
      const next = attemptChallenge(fresh(), checked, false, 'You slip.', MAX_SETBACKS);
      expect(challengeProgress(next)).toBe('ongoing');
      expect(next.setbacks).toBe(1);
   });

   it('turns back once setbacks reach the cap', () => {
      let state = fresh();
      for (let i = 0; i < MAX_SETBACKS; i++)
         state = attemptChallenge(state, checked, false, '', MAX_SETBACKS);
      expect(challengeProgress(state)).toBe('turn-back');
   });

   it('lets a failure outcome end the challenge outright', () => {
      const next = attemptChallenge(fresh(), giveUp, false, '', MAX_SETBACKS);
      expect(challengeProgress(next)).toBe('turn-back');
   });

   it('burns a one-shot option on failure', () => {
      const next = attemptChallenge(fresh(), oneShot, false, '', MAX_SETBACKS);
      expect(next.spentOptionIds).toContain('search');
      expect(availableOptions([checked, oneShot], next).map((o) => o.id)).toEqual(['climb']);
   });

   it('treats a checkless option as an automatic success', () => {
      const next = attemptChallenge(fresh(), ignore, false, 'You walk on.', MAX_SETBACKS);
      expect(challengeProgress(next)).toBe('proceed');
      expect(next.setbacks).toBe(0);
   });

   it('does not mutate the previous state', () => {
      const before = fresh();
      attemptChallenge(before, checked, false, 'x', MAX_SETBACKS);
      expect(before.setbacks).toBe(0);
      expect(challengeProgress(before)).toBe('ongoing');
   });
});

describe('appliedOutcome', () => {
   it('returns the success outcome for checkless options regardless of the flag', () => {
      expect(appliedOutcome(ignore, false)).toBe(ignore.success);
   });

   it('falls back to a generic retry when a checked option lacks a failure', () => {
      const sloppy: ChallengeOption = { ...checked, failure: undefined };
      expect(appliedOutcome(sloppy, false).result).toBe('retry');
   });
});

describe('challengeStateFrom', () => {
   it('round-trips a state through the opaque blob', () => {
      const state = attemptChallenge(fresh(), checked, false, 'You slip.', MAX_SETBACKS);
      expect(challengeStateFrom({ ...state })).toEqual(state);
   });

   it('tolerates a malformed blob without crashing (D10 rule 3)', () => {
      const state = challengeStateFrom({ setbacks: 'two', toId: 7, resolution: 'nonsense', optionTargets: { climb: 'high' }, junk: true });
      expect(state.setbacks).toBe(0);
      expect(state.toId).toBe('');
      expect(state.resolution).toBe('');
      expect(state.optionTargets).toEqual({});
      expect(challengeProgress(state)).toBe('ongoing');
   });
});
