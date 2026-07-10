// Discord adapter (marked): the `forage` hub action's EXECUTION side — the
// first LIVE gather (S1, R16). A gather is a SHORT action (D5 rule 1): the
// whole decision runs in memory under the character lock and commits as a few
// small writes (AP spend, grants, skill credit) — no ActivitySession. The
// interaction must already be acknowledged with `deferUpdate()`; the hub's own
// ephemeral message is repainted with the outcome banner so the play loop
// continues in place (D30). Identification results deliberately show NO roll —
// a confident mislabel must read exactly like the truth (identify.ts).
import type { MessageComponentInteraction } from 'discord.js';
import { characterService } from '../../db/services/characterService.js';
import { inventoryService } from '../../db/services/inventoryService.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { canCharacterAct, type ActBlockReason } from '../../game/character/rules.js';
import { attributesWithEquipment } from '../../game/character/inventory.js';
import { displayName } from '../../game/character/identity.js';
import { locationName } from '../../game/data/locations.js';
import { skillNode } from '../../game/data/skills.js';
import {
   FORAGE_AP_COST,
   groupYields,
   noteworthyYields,
   professionNodeAt,
   resolveGather,
   yieldDisplayName,
   type GrantOrder,
} from '../../game/professions/gather.js';
import { postChronicle } from '../../game/chronicle.js';
import { freshHubView } from './_hubView.js';
import { sessionStepView } from './_playPanel.js';
import type { SkillLevelUp } from '../../game/character/skills.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

const FORAGE_BLOCK_MESSAGE: Record<ActBlockReason, string> = {
   'not-approved': 'Only characters recognized by the Imperator may work Deltrada\'s lands.',
   'incapacitated': 'You are in no state to grub through the undergrowth — recover first.',
   'no-action-points': `You lack the Action Points to forage (it costs ${FORAGE_AP_COST}).`,
};

/**
 * Executes one forage attempt for the hub. Mirrors performTravel's
 * choreography: lock → fresh re-read → session/AP gates → atomic AP spend →
 * resolve in memory → grant → credit skill use → chronicle rare finds →
 * repaint the hub wherever the character stands.
 */
export async function performForage(client: ToscheClient, interaction: MessageComponentInteraction, character: CharacterDoc): Promise<void> {
   await client.locks.runExclusive([character._id], async () => {
      const fresh = await characterService.get(character._id);
      if (!fresh) {
         await interaction.editReply({ content: 'Your character vanished mid-reach. Try again.', embeds: [], components: [] });
         return;
      }

      const session = await activitySessionService.getActiveForParticipant(fresh._id);
      if (session) {
         const view = sessionStepView(session, '⚠️ You are already in the middle of something — deal with it first.');
         await interaction.editReply(view ?? { content: `You are busy with: ${session.type}.`, embeds: [], components: [] });
         return;
      }

      const located = professionNodeAt(fresh.locationId, 'foraging');
      if (!located) {
         await interaction.editReply(await freshHubView(fresh, '🌿 Nothing grows here worth stooping for.'));
         return;
      }

      const act = canCharacterAct(fresh, FORAGE_AP_COST);
      if (!act.ok) {
         await interaction.editReply(await freshHubView(fresh, FORAGE_BLOCK_MESSAGE[act.reason]));
         return;
      }

      if (!await characterService.spendActionPoints(fresh._id, FORAGE_AP_COST)) {
         await interaction.editReply(await freshHubView(fresh, FORAGE_BLOCK_MESSAGE['no-action-points']));
         return;
      }

      // The roll reads equipment-modified attributes, like every other check (D28).
      const subject = { ...fresh, attributes: attributesWithEquipment(fresh) };
      const resolution = resolveGather(subject, located.node);

      // Grant the haul (encumbrance-checked per order); a full pack loses the
      // remainder honestly rather than overflowing it.
      const granted: GrantOrder[] = [];
      const leftBehind: GrantOrder[] = [];
      for (const order of groupYields(resolution.yields)) {
         const result = await inventoryService.grantItems(fresh._id, order.itemId, order.quality, order.quantity, order.mystery ?? undefined);
         (result.ok ? granted : leftBehind).push(order);
      }

      // Learn-by-doing (D40): the gather check trains the node's skill path,
      // success or failure alike; the identify sweep (rolled only over a real
      // haul) trains the Identify path. Rank-ups narrate (skills.md).
      const levelUps: SkillLevelUp[] = [];
      levelUps.push(...await characterService.creditSkillUse(fresh._id, [located.node.skillNode], resolution.gatherTrainingWeight));
      if (resolution.identifyTrainingWeight !== null)
         levelUps.push(...await characterService.creditSkillUse(fresh._id, ['identify_forage'], resolution.identifyTrainingWeight));

      const updated = await characterService.get(fresh._id) ?? fresh;
      const banner = forageBanner(located.node.name, located.node.emptyLine, resolution, granted, leftBehind, levelUps);
      await interaction.editReply(await freshHubView(updated, banner));

      // Rare finds make the chronicle (D24) — only ones the finder actually
      // RECOGNIZED and kept; an unidentified rarity is still nobody's news.
      const keptIds = new Set(granted.filter((order) => order.mystery === null).map((order) => order.itemId));
      for (const rare of noteworthyYields(resolution.yields).filter((yielded) => keptIds.has(yielded.itemId)))
         await postChronicle(client, `🌿 **${displayName(fresh)}** foraged a **${yieldDisplayName({ ...rare, mystery: null })}** at **${locationName(fresh.locationId)}**.`);
   });
}

function forageBanner(
   nodeName: string,
   emptyLine: string,
   resolution: ReturnType<typeof resolveGather>,
   granted: GrantOrder[],
   leftBehind: GrantOrder[],
   levelUps: SkillLevelUp[],
): string {
   const roll = `(🎲 ${resolution.check.roll} vs **${resolution.check.target}%**)`;
   const lines: string[] = [];

   if (!resolution.check.success) {
      lines.push(`🌿 ${emptyLine} ${roll}`);
   } else {
      const haul = granted.map((order) => `**${yieldDisplayName(order)}**${order.quantity > 1 ? ` ×${order.quantity}` : ''}`).join(', ');
      lines.push(haul
         ? `🌿 You work ${nodeName} and come away with: ${haul}. ${roll}`
         : `🌿 You find plenty in ${nodeName} — and no room in your pack for any of it. ${roll}`);

      if (leftBehind.length > 0 && haul)
         lines.push(`🎒 Your pack is full — you leave ${leftBehind.map((order) => `**${yieldDisplayName(order)}**${order.quantity > 1 ? ` ×${order.quantity}` : ''}`).join(', ')} behind.`);
   }

   if (levelUps.length > 0)
      lines.push(`📈 The work taught you something — ${levelUps.map((up) => `**${skillNode(up.node).name}** rises to **${up.to}**`).join(', ')}.`);

   return lines.join('\n');
}
