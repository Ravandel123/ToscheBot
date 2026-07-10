import { describe, expect, it } from 'vitest';
import {
   appliedDialogueOutcome,
   availableDialogueOptions,
   computeDialogueTargets,
   dialogueGateCheck,
   dialogueNodeOf,
   dialogueOptionKey,
   dialogueProgress,
   dialogueStateFrom,
   fillDialogueLine,
   initialDialogueState,
   pickDialogueOption,
   type DialogueState,
} from './dialogue.js';
import { DIALOGUE_END, DIALOGUES, WORK_LINES, type DialogueNode, type DialogueOption } from '../data/dialogues.js';
import { NPCS, npcCharacterId } from '../data/npcs.js';
import { ATTRIBUTES, type AttributeKey } from '../data/attributes.js';
import type { CheckSubject } from '../checks.js';

const MARREK = npcCharacterId('old_campaigner');

function subject(value = 30): CheckSubject {
   const attributes = Object.fromEntries(
      (Object.keys(ATTRIBUTES) as AttributeKey[]).map((key) => [key, value]),
   ) as Record<AttributeKey, number>;

   return { attributes, progression: { skills: {} }, identity: { race: null } };
}

function freshState(overrides: Partial<DialogueState> = {}): DialogueState {
   return { ...initialDialogueState('marrek_tales', MARREK, 'corner', {}, {}), ...overrides };
}

const CHECKLESS: DialogueOption = { id: 'plain', label: 'Say a thing', emoji: '💬', success: { next: 'somewhere' } };

describe('dialogueStateFrom', () => {
   it('round-trips a real state through a plain blob', () => {
      const state = freshState({ flags: ['heard_truth'], spentOptionKeys: ['corner.scar'], traits: { courage: 2 }, lastLine: 'x', optionTargets: { 'corner.scar': 45 } });
      expect(dialogueStateFrom({ ...state })).toEqual(state);
   });

   it('tolerates a malformed / empty blob without crashing (D10 rule 3)', () => {
      const state = dialogueStateFrom({ dialogueId: 42, flags: 'nope', traits: { courage: 'many', bogus: 3 }, optionTargets: { a: 'NaN' }, resolution: 'weird' });
      expect(state.dialogueId).toBe('');
      expect(state.flags).toEqual([]);
      expect(state.traits).toEqual({});
      expect(state.optionTargets).toEqual({});
      expect(state.resolution).toBe('');
      expect(dialogueNodeOf(state)).toBeNull();
   });
});

describe('computeDialogueTargets', () => {
   it('precomputes a target for every rolled option across the graph — and only those', () => {
      const targets = computeDialogueTargets(subject(), DIALOGUES.marrek_tales);

      expect(targets[dialogueOptionKey('corner', 'scar')]).toBeGreaterThanOrEqual(5);
      // Checkless options get no entry (their buttons show no %).
      expect(targets[dialogueOptionKey('corner', 'wall')]).toBeUndefined();

      // Widen off the `as const` literals so the optional `check` is visible.
      for (const [key, node] of Object.entries(DIALOGUES.marrek_tales.nodes) as [string, DialogueNode][])
         for (const option of node.options)
            expect(dialogueOptionKey(key, option.id) in targets, `${key}.${option.id}`).toBe(!!option.check);
   });
});

describe('gates and availability', () => {
   const gated: DialogueOption = {
      ...CHECKLESS,
      id: 'gated',
      requires: { flags: ['met_before'], minTraits: { courage: 1 }, reason: 'earn it first' },
   };
   const hidden: DialogueOption = { ...gated, id: 'secret', hidden: true };
   const node: DialogueNode = { line: 'Test.', options: [CHECKLESS, gated, hidden] };

   it('an unmet gate locks a visible option and drops a hidden one', () => {
      const options = availableDialogueOptions('n', node, freshState());
      expect(options.map(({ option, ok }) => [option.id, ok])).toEqual([['plain', true], ['gated', false]]);
      expect(options[1].reason).toBe('earn it first');
   });

   it('a met gate (flags AND traits) opens both, and spent one-shots vanish', () => {
      const state = freshState({ flags: ['met_before'], traits: { courage: 1 }, spentOptionKeys: [dialogueOptionKey('n', 'plain')] });
      const options = availableDialogueOptions('n', node, state);
      expect(options.map(({ option, ok }) => [option.id, ok])).toEqual([['gated', true], ['secret', true]]);
   });

   it('gateCheck reports partial misses (flags met, traits short)', () => {
      const state = freshState({ flags: ['met_before'] });
      expect(dialogueGateCheck(gated, state)).toEqual({ ok: false, reason: 'earn it first' });
   });
});

describe('pickDialogueOption', () => {
   const rolled: DialogueOption = {
      id: 'ask',
      label: '[Persuade] Ask',
      emoji: '🎭',
      check: { node: 'persuade' },
      oneShot: true,
      success: { next: 'good', effects: { flags: ['told', 'told'], traits: { honor: 1 } } },
      failure: { next: 'bad', effects: { traits: { cruelty: -5 } } },
   };

   it('success routes to the success node and applies effects to the snapshot', () => {
      const next = pickDialogueOption(freshState(), 'corner', rolled, true, 'the line');
      expect(next.nodeId).toBe('good');
      expect(next.flags).toEqual(['told']); // deduped
      expect(next.traits.honor).toBe(1);
      expect(next.spentOptionKeys).toEqual([dialogueOptionKey('corner', 'ask')]);
      expect(next.lastLine).toBe('the line');
      expect(dialogueProgress(next)).toBe('ongoing');
   });

   it('failure routes to the failure node and clamps trait deltas at 0 (mirrors applyTraitDeltas)', () => {
      const next = pickDialogueOption(freshState({ traits: { cruelty: 2 } }), 'corner', rolled, false, '');
      expect(next.nodeId).toBe('bad');
      expect(next.traits.cruelty).toBe(0);
   });

   it('an END route resolves the conversation without moving the node', () => {
      const leave: DialogueOption = { ...CHECKLESS, id: 'leave', success: { next: DIALOGUE_END } };
      const next = pickDialogueOption(freshState(), 'corner', leave, true, 'farewell');
      expect(next.resolution).toBe('ended');
      expect(next.nodeId).toBe('corner');
      expect(dialogueProgress(next)).toBe('ended');
   });

   it('a rolled option with no failure route falls back to a graceful end', () => {
      const sloppy: DialogueOption = { ...CHECKLESS, id: 'oops', check: { node: 'persuade' } };
      expect(appliedDialogueOutcome(sloppy, false).next).toBe(DIALOGUE_END);
      expect(appliedDialogueOutcome(sloppy, true).next).toBe('somewhere');
   });
});

describe('fillDialogueLine', () => {
   it('fills {npc}/{epithet}/{work} from the roster', () => {
      const filled = fillDialogueLine('{npc} ({epithet}) says: {work}', MARREK);
      expect(filled).toContain(NPCS.old_campaigner.name);
      expect(filled).toContain(NPCS.old_campaigner.epithet);
      expect(filled).toContain(WORK_LINES[NPCS.old_campaigner.archetype]);
   });

   it('degrades to neutral stand-ins for a retired roster id (D10 rule 3)', () => {
      const filled = fillDialogueLine('{npc}: {work}', 'npc-retired');
      expect(filled).toContain('The stranger');
      expect(filled).not.toContain('{');
   });
});
