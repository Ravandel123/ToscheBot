import { describe, expect, it } from 'vitest';
import {
   ARCHETYPE_DIALOGUES,
   DIALOGUE_END,
   DIALOGUES,
   dialogueIdFor,
   isDialogueId,
   WORK_LINES,
   type DialogueDefinition,
   type DialogueId,
} from './dialogues.js';
import { NPCS, npcCharacterId, type NpcDefinition, type NpcId } from './npcs.js';

// Graph-integrity checks for the dialogue catalog (D45), in the spirit of the
// location-edge tests: a dangling `next`, an unreachable node, a rolled option
// without a failure route or a bad NPC assignment fails `npm test` here — not
// mid-conversation on the live bot.

const dialogues = Object.entries(DIALOGUES) as [DialogueId, DialogueDefinition][];

const PLACEHOLDERS = ['{npc}', '{epithet}', '{work}'];

describe('DIALOGUES graph integrity', () => {
   it('has content at all', () => {
      expect(dialogues.length).toBeGreaterThan(0);
   });

   it('start node exists and no node id shadows the END sentinel', () => {
      for (const [id, dialogue] of dialogues) {
         expect(dialogue.nodes[dialogue.start], `${id} start node`).toBeDefined();
         expect(dialogue.nodes[DIALOGUE_END], `${id} has a node literally named '${DIALOGUE_END}'`).toBeUndefined();
      }
   });

   it('every outcome routes to an existing node or END', () => {
      for (const [id, dialogue] of dialogues)
         for (const [nodeId, node] of Object.entries(dialogue.nodes))
            for (const option of node.options)
               for (const outcome of [option.success, option.failure])
                  if (outcome)
                     expect(
                        outcome.next === DIALOGUE_END || outcome.next in dialogue.nodes,
                        `${id}.${nodeId}.${option.id} routes to unknown node '${outcome.next}'`,
                     ).toBe(true);
   });

   it('every node is reachable from start', () => {
      for (const [id, dialogue] of dialogues) {
         const reached = new Set<string>();
         const queue = [dialogue.start];

         while (queue.length > 0) {
            const nodeId = queue.pop()!;
            if (reached.has(nodeId) || !(nodeId in dialogue.nodes))
               continue;
            reached.add(nodeId);
            for (const option of dialogue.nodes[nodeId].options)
               queue.push(option.success.next, ...(option.failure ? [option.failure.next] : []));
         }

         for (const nodeId of Object.keys(dialogue.nodes))
            expect(reached.has(nodeId), `${id}.${nodeId} is unreachable from '${dialogue.start}'`).toBe(true);
      }
   });

   it('option ids are unique within their node and customId-safe', () => {
      for (const [id, dialogue] of dialogues)
         for (const [nodeId, node] of Object.entries(dialogue.nodes)) {
            const ids = node.options.map((option) => option.id);
            expect(new Set(ids).size, `${id}.${nodeId} duplicate option ids`).toBe(ids.length);
            for (const optionId of ids)
               expect(optionId, `${id}.${nodeId}.${optionId} rides in customIds`).not.toContain(':');
         }
   });

   it('rolled options declare a failure route; hidden options have a gate', () => {
      for (const [id, dialogue] of dialogues)
         for (const [nodeId, node] of Object.entries(dialogue.nodes))
            for (const option of node.options) {
               if (option.check)
                  expect(option.failure, `${id}.${nodeId}.${option.id} rolls a check without a failure route`).toBeDefined();
               if (option.hidden)
                  expect(option.requires, `${id}.${nodeId}.${option.id} is hidden with nothing to unlock it`).toBeDefined();
            }
   });

   it('every node must offer a way OUT (an END route somewhere in the graph)', () => {
      for (const [id, dialogue] of dialogues) {
         const endsSomewhere = Object.values(dialogue.nodes).some((node) =>
            node.options.some((option) => option.success.next === DIALOGUE_END || option.failure?.next === DIALOGUE_END));
         expect(endsSomewhere, `${id} has no ending option anywhere`).toBe(true);
      }
   });

   it('NPC lines only use known placeholders', () => {
      for (const [id, dialogue] of dialogues)
         for (const [nodeId, node] of Object.entries(dialogue.nodes))
            for (const token of node.line.match(/\{[^}]*\}/g) ?? [])
               expect(PLACEHOLDERS, `${id}.${nodeId} uses unknown placeholder ${token}`).toContain(token);
   });
});

describe('dialogue assignment', () => {
   it('every archetype small-talk mapping and every authored dialogueId resolves', () => {
      for (const dialogueId of Object.values(ARCHETYPE_DIALOGUES))
         expect(isDialogueId(dialogueId)).toBe(true);

      for (const [npcId, npc] of Object.entries(NPCS) as [NpcId, NpcDefinition][])
         if (npc.dialogueId)
            expect(isDialogueId(npc.dialogueId), `${npcId} references unknown dialogue '${npc.dialogueId}'`).toBe(true);
   });

   it('every WORK_LINES archetype is covered (the {work} placeholder never falls through)', () => {
      for (const npc of Object.values(NPCS))
         expect(WORK_LINES[npc.archetype]).toBeTruthy();
   });

   it('resolves an authored tree over the template, and null off-roster (D10 rule 3)', () => {
      expect(dialogueIdFor(npcCharacterId('old_campaigner'))).toBe('marrek_tales');
      expect(dialogueIdFor(npcCharacterId('plaza_merchant'))).toBe('small_talk');
      expect(dialogueIdFor(npcCharacterId('retired_npc'))).toBeNull();
      expect(dialogueIdFor(crypto.randomUUID())).toBeNull();
   });
});
