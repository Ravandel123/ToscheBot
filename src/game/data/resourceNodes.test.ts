import { describe, expect, it } from 'vitest';
import { RESOURCE_NODES, isResourceNodeId, resourceNode, type ResourceNodeId } from './resourceNodes.js';
import { FORAGABLE_ITEM_IDS, isForagableId } from './foragables.js';
import { LOCATIONS, type LocationDefinition, type LocationId } from './locations.js';
import { HUB_ACTIONS, hubAction } from './hubActions.js';
import { SKILL_NODES } from './skills.js';

// Content-integrity checks for the gather layer (R16): the node ids locations
// reference, the item ids tables yield and the skill nodes checks roll must
// all resolve — a typo here is a dead button or a crash mid-gather.

const nodeEntries = Object.keys(RESOURCE_NODES).map((id) => [id, resourceNode(id as ResourceNodeId)] as const);
const locationEntries = Object.entries(LOCATIONS) as [LocationId, LocationDefinition][];

describe('RESOURCE_NODES catalog', () => {
   it('tables reference real foragables with positive weights', () => {
      for (const [id, node] of nodeEntries)
         for (const [itemId, weight] of node.table) {
            expect(isForagableId(itemId), `${id} yields unknown item '${itemId}'`).toBe(true);
            expect(weight, `${id} weight for ${itemId}`).toBeGreaterThan(0);
         }
   });

   it('checks roll real skill nodes and carry an empty line', () => {
      for (const [id, node] of nodeEntries) {
         expect(node.skillNode in SKILL_NODES, `${id} rolls unknown skill '${node.skillNode}'`).toBe(true);
         expect(node.emptyLine.length, `${id} emptyLine`).toBeGreaterThan(0);
      }
   });

   it('every foragable is reachable from some node table (no orphan content)', () => {
      const yielded = new Set(nodeEntries.flatMap(([, node]) => node.table.map(([itemId]) => itemId)));
      for (const itemId of FORAGABLE_ITEM_IDS)
         expect(yielded.has(itemId), `${itemId} is in no gather table`).toBe(true);
   });
});

describe('locations ↔ resource nodes ↔ forage action (the S1 wiring)', () => {
   it('locations reference only real node ids (validated like graph edges)', () => {
      for (const [id, location] of locationEntries)
         for (const nodeId of location.resourceNodes ?? [])
            expect(isResourceNodeId(nodeId), `${id} references unknown node '${nodeId}'`).toBe(true);
   });

   it('the forage hub action is offered exactly where a foraging node exists', () => {
      const withForaging = locationEntries
         .filter(([, location]) => (location.resourceNodes ?? []).some((id) => resourceNode(id).profession === 'foraging'))
         .map(([id]) => id)
         .sort();

      const offered = [...HUB_ACTIONS.forage.locations].sort();
      expect(offered).toEqual(withForaging);
   });

   it('the forage action is LIVE (no comingSoon — the play router owns it)', () => {
      expect(hubAction('forage')?.comingSoon).toBeUndefined();
   });
});
