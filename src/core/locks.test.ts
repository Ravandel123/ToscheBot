import { describe, expect, it } from 'vitest';
import { CharacterLockManager } from './locks.js';

/** A promise plus its resolver, to control when a critical section finishes. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
   let resolve!: () => void;
   const promise = new Promise<void>((res) => {
      resolve = res;
   });
   return { promise, resolve };
}

/** Lets pending microtasks/timers settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('CharacterLockManager', () => {
   it('serializes runs that touch the same character', async () => {
      const lock = new CharacterLockManager();
      const order: string[] = [];
      const gate = deferred();

      const p1 = lock.runExclusive(['u1'], async () => {
         order.push('1-start');
         await gate.promise;
         order.push('1-end');
      });
      const p2 = lock.runExclusive(['u1'], async () => {
         order.push('2-start');
      });

      await flush();
      expect(order).toEqual(['1-start']); // p2 is blocked behind p1

      gate.resolve();
      await Promise.all([p1, p2]);
      expect(order).toEqual(['1-start', '1-end', '2-start']);
   });

   it('lets runs for different characters proceed concurrently', async () => {
      const lock = new CharacterLockManager();
      const order: string[] = [];
      const gate = deferred();

      const p1 = lock.runExclusive(['a'], async () => {
         order.push('a');
         await gate.promise;
      });
      const p2 = lock.runExclusive(['b'], async () => {
         order.push('b');
      });

      await flush();
      expect(order.sort()).toEqual(['a', 'b']); // both entered despite 'a' still holding

      gate.resolve();
      await Promise.all([p1, p2]);
   });

   it('reports lock state and clears it after the run', async () => {
      const lock = new CharacterLockManager();
      const gate = deferred();

      const run = lock.runExclusive(['x'], async () => {
         await gate.promise;
      });

      await flush();
      expect(lock.isLocked('x')).toBe(true);
      expect(lock.lockedIds()).toEqual(['x']);

      gate.resolve();
      await run;
      expect(lock.isLocked('x')).toBe(false);
   });

   it('cannot deadlock when two runs request the same characters in crossed order', async () => {
      const lock = new CharacterLockManager();
      const order: string[] = [];
      const gate = deferred();

      const p1 = lock.runExclusive(['a', 'b'], async () => {
         order.push('p1');
         await gate.promise;
      });
      const p2 = lock.runExclusive(['b', 'a'], async () => {
         order.push('p2');
      });

      await flush();
      expect(order).toEqual(['p1']); // p2 waits for both locks

      gate.resolve();
      await Promise.all([p1, p2]);
      expect(order).toEqual(['p1', 'p2']);
   });

   it('runs a deferred op immediately when the character is free', async () => {
      const lock = new CharacterLockManager();
      let ran = false;

      await lock.deferOrRun('y', async () => {
         ran = true;
      });

      expect(ran).toBe(true);
   });

   it('queues a deferred op while locked and drains it FIFO after release', async () => {
      const lock = new CharacterLockManager();
      const events: string[] = [];
      const gate = deferred();

      const run = lock.runExclusive(['z'], async () => {
         events.push('fn-start');
         await gate.promise;
         events.push('fn-end');
      });

      await flush();
      await lock.deferOrRun('z', async () => {
         events.push('deferred-1');
      });
      await lock.deferOrRun('z', async () => {
         events.push('deferred-2');
      });
      expect(events).toEqual(['fn-start']); // both deferred, not run yet

      gate.resolve();
      await run;
      await flush();
      expect(events).toEqual(['fn-start', 'fn-end', 'deferred-1', 'deferred-2']);
   });

   it('completes deferred ops before a queued runExclusive enters', async () => {
      const lock = new CharacterLockManager();
      const events: string[] = [];
      const fnGate = deferred();
      const opGate = deferred();

      const run1 = lock.runExclusive(['c'], async () => {
         await fnGate.promise;
      });
      await flush();

      // Queue a slow deferred op AND a second holder while run1 still holds 'c'.
      await lock.deferOrRun('c', async () => {
         events.push('op-start');
         await opGate.promise;
         events.push('op-end');
      });
      const run2 = lock.runExclusive(['c'], async () => {
         events.push('fn2');
      });

      fnGate.resolve();
      await flush();
      // The invariant under test: the deferred op must fully finish before the
      // next holder's critical section starts — no interleaving.
      expect(events).toEqual(['op-start']);

      opGate.resolve();
      await Promise.all([run1, run2]);
      expect(events).toEqual(['op-start', 'op-end', 'fn2']);
   });

   it('releases locks even when fn throws', async () => {
      const lock = new CharacterLockManager();

      await expect(
         lock.runExclusive(['e'], () => Promise.reject(new Error('boom'))),
      ).rejects.toThrow('boom');

      expect(lock.isLocked('e')).toBe(false);
   });
});
