import { describe, expect, it } from 'vitest';
import {
   OBSTACLE_PROGRESS_TO_CLEAR,
   OBSTACLE_SETBACKS_TO_FAIL,
   attemptObstacle,
   initialObstacleState,
   obstacleOutcome,
   obstacleStateFrom,
} from './obstacle.js';

const fresh = () => initialObstacleState('fallen_tree', 'plaza', 'tavern');

describe('attemptObstacle', () => {
   it('counts a success toward progress and keeps the flavor line', () => {
      const next = attemptObstacle(fresh(), true, 'Up you go.');
      expect(next.progress).toBe(1);
      expect(next.setbacks).toBe(0);
      expect(next.lastLine).toBe('Up you go.');
   });

   it('counts a failure toward setbacks', () => {
      const next = attemptObstacle(fresh(), false, 'You slip.');
      expect(next.progress).toBe(0);
      expect(next.setbacks).toBe(1);
   });

   it('does not mutate the previous state', () => {
      const before = fresh();
      attemptObstacle(before, true, 'x');
      expect(before.progress).toBe(0);
   });
});

describe('obstacleOutcome', () => {
   it('is ongoing until a threshold is reached', () => {
      expect(obstacleOutcome(fresh())).toBe('ongoing');
   });

   it('clears at the progress threshold', () => {
      let state = fresh();
      for (let i = 0; i < OBSTACLE_PROGRESS_TO_CLEAR; i++)
         state = attemptObstacle(state, true, '');
      expect(obstacleOutcome(state)).toBe('cleared');
   });

   it('forces back at the setback threshold', () => {
      let state = fresh();
      for (let i = 0; i < OBSTACLE_SETBACKS_TO_FAIL; i++)
         state = attemptObstacle(state, false, '');
      expect(obstacleOutcome(state)).toBe('forced-back');
   });
});

describe('obstacleStateFrom', () => {
   it('round-trips a state through the opaque blob', () => {
      const state = attemptObstacle(fresh(), true, 'line');
      expect(obstacleStateFrom({ ...state })).toEqual(state);
   });

   it('tolerates a malformed blob without crashing (D10 rule 3)', () => {
      const state = obstacleStateFrom({ progress: 'two', toId: 7, junk: true });
      expect(state.progress).toBe(0);
      expect(state.toId).toBe('');
      expect(obstacleOutcome(state)).toBe('ongoing');
   });
});
