// Discord adapter (marked): the `talk` hub action's EXECUTION side (S4/D45).
// Two halves, split like travel's pick-then-move:
//   * showTalkPicker — READ-ONLY: repaints the hub message into a "who do you
//     approach?" panel listing the NPCs standing here (no lock — views render
//     from the DB and staleness self-heals on the next click);
//   * performTalk — the mutation: under the character lock (fresh re-read,
//     busy re-entry, presence re-checked at click time) opens the durable
//     `dialogue` ActivitySession and shows its first node. Starting a talk is
//     FREE (0 AP — conversations.md); rolled options pay as they happen.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder, type MessageComponentInteraction } from 'discord.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { canCharacterAct, type ActBlockReason } from '../../game/character/rules.js';
import { attributesWithEquipment } from '../../game/character/inventory.js';
import { displayName } from '../../game/character/identity.js';
import { computeDialogueTargets, initialDialogueState } from '../../game/activity/dialogue.js';
import { DIALOGUES, dialogueIdFor } from '../../game/data/dialogues.js';
import { npcDefinition } from '../../game/data/npcs.js';
import { resolveLocationId } from '../../game/data/locations.js';
import { freshHubView } from './_hubView.js';
import { sessionStepView } from './_playPanel.js';
import type { ActivitySessionDoc } from '../../db/models/activitySession.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

const TALK_COLOR = 0x8A6D9B; // matches the dialogue panel

const TALK_BLOCK_MESSAGE: Record<ActBlockReason, string> = {
   'not-approved': 'Only characters recognized by the Imperator get more than a wary nod here.',
   'incapacitated': 'You can barely stand, let alone hold a conversation — recover first.',
   'no-action-points': 'You lack the Action Points to talk.', // unreachable at cost 0; keys must be total
};

/** The "who do you approach?" panel — or the hub with a lonely banner when
 *  nobody talkable stands here. Read-only; the real checks rerun in performTalk. */
export async function showTalkPicker(interaction: MessageComponentInteraction, character: CharacterDoc, locationId: string): Promise<void> {
   const present = await characterService.atLocation(locationId);
   const npcs = present.filter((who) => who.ownerId === null && dialogueIdFor(who._id) !== null);

   if (npcs.length === 0) {
      await interaction.update(await freshHubView(character, '💬 You look around for a familiar face, but no one here has time for words.'));
      return;
   }

   const embed = new EmbedBuilder()
      .setColor(TALK_COLOR)
      .setTitle('💬 Talk to someone')
      .setDescription([
         'A few of the locals look approachable enough. Who gets your time?',
         '',
         ...npcs.map((npc) => `💬 **${displayName(npc)}**`),
      ].join('\n'));

   const buttons = [
      ...npcs.map((npc) =>
         new ButtonBuilder()
            .setCustomId(`play:talkto:${npc._id}`)
            .setLabel(npcDefinition(npc._id)?.name ?? displayName(npc))
            .setEmoji('💬')
            .setStyle(ButtonStyle.Primary),
      ),
      new ButtonBuilder().setCustomId('play:hub').setLabel('Never mind').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
   ];

   const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
   for (let i = 0; i < buttons.length; i += 5)
      rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons.slice(i, i + 5)));

   await interaction.update({ content: '', embeds: [embed], components: rows });
}

/**
 * Opens a conversation with an NPC for the hub. The `interaction` must already
 * be acknowledged with `deferUpdate()`. Mirrors performTravel's choreography:
 * lock → fresh re-read → busy re-entry (D22) → act gate → validate the NPC is
 * still HERE and still talkable → create the session → show its first node.
 */
export async function performTalk(client: ToscheClient, interaction: MessageComponentInteraction, character: CharacterDoc, npcCharacterId: string): Promise<void> {
   await client.locks.runExclusive([character._id], async () => {
      const fresh = await characterService.get(character._id);
      if (!fresh) {
         await interaction.editReply({ content: 'Your character vanished mid-greeting. Try again.', embeds: [], components: [] });
         return;
      }

      // Cross-restart busy check (D17): an active session means re-entry, not a new talk.
      const session = await activitySessionService.getActiveForParticipant(fresh._id);
      if (session) {
         await editReplyStep(interaction, session, '⚠️ You are already in the middle of something — deal with it first.');
         return;
      }

      const act = canCharacterAct(fresh, 0);
      if (!act.ok) {
         await interaction.editReply(await freshHubView(fresh, TALK_BLOCK_MESSAGE[act.reason]));
         return;
      }

      // The NPC must stand where the character stands NOW (a stale picker can
      // outlive a move on either side) and still resolve to a conversation.
      const npc = await characterService.get(npcCharacterId);
      const dialogueId = npc?.ownerId === null ? dialogueIdFor(npc._id) : null;
      if (!npc || !dialogueId) {
         await interaction.editReply(await freshHubView(fresh, '💬 Whoever that was, they are gone — or were never one for words.'));
         return;
      }
      if (resolveLocationId(npc.locationId) !== resolveLocationId(fresh.locationId)) {
         await interaction.editReply(await freshHubView(fresh, `💬 **${displayName(npc)}** is no longer here.`));
         return;
      }

      // Per-option d100 targets are computed HERE, from the live (equipment-
      // modified) talker, and stored in the session so the stateless panel
      // shows honest % odds on every repaint (D26/D28).
      const dialogue = DIALOGUES[dialogueId];
      const subject = { ...fresh, attributes: attributesWithEquipment(fresh) };
      const state = initialDialogueState(dialogueId, npc._id, dialogue.start, fresh.traits ?? {}, computeDialogueTargets(subject, dialogue));

      const created = await activitySessionService.create('dialogue', [fresh._id], { ...state });
      await editReplyStep(interaction, created, `💬 You approach **${displayName(npc)}**.`);
   });
}

async function editReplyStep(interaction: MessageComponentInteraction, session: ActivitySessionDoc, note: string): Promise<void> {
   const view = sessionStepView(session, note);
   await interaction.editReply(view ?? { content: `${note}\n(Your character is busy with: ${session.type}.)`, embeds: [], components: [] });
}
