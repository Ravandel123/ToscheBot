// Discord adapter (marked): the 'dialogue' activity handler (R14/D45) — a
// conversation with an NPC, run on the challenge handler's proven shape:
//   * each pick = one step-guarded `advance` (idempotent against double-clicks
//     and crash-replay); the outcome line + roll summary ride IN the state so
//     repaints are stable;
//   * terminal picks: commit the final state via `advance` (winning the guard =
//     owning completion), THEN the idempotent tail (nothing but cleanup here —
//     trait/skill writes ride the winning pick itself), THEN delete the
//     session; a crash in between leaves a farewell view with a "Part ways"
//     finalize re-entry.
// Rolled options charge DIALOGUE_CHECK_AP_COST and train their node's path
// (D40); checkless lines are free. The NPC is not a participant — see
// game/activity/dialogue.ts for the two v1 shape decisions.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type ButtonInteraction, type MessageActionRowComponentBuilder } from 'discord.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { characterService } from '../../../db/services/characterService.js';
import { freshHubView } from '../_hubView.js';
import {
   appliedDialogueOutcome,
   availableDialogueOptions,
   dialogueGateCheck,
   dialogueNodeOf,
   dialogueOptionKey,
   dialogueProgress,
   dialogueStateFrom,
   DIALOGUE_CHECK_AP_COST,
   fillDialogueLine,
   pickDialogueOption,
   type AvailableDialogueOption,
   type DialogueState,
} from '../../../game/activity/dialogue.js';
import { canCharacterAct } from '../../../game/character/rules.js';
import { attributesWithEquipment } from '../../../game/character/inventory.js';
import { npcDefinition } from '../../../game/data/npcs.js';
import { skillNode } from '../../../game/data/skills.js';
import { checkTarget, checkTrainingWeight, rollAgainst } from '../../../game/checks.js';
import { randomItem } from '../../../lib/random.js';
import { log } from '../../../lib/log.js';
import type { SkillLevelUp } from '../../../game/character/skills.js';
import type { ActivityHandler, ActivityView } from '../../../types/activities.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';
import type { CharacterDoc } from '../../../db/models/character.js';

const DIALOGUE_COLOR = 0x8A6D9B; // tavern-candle violet

export default {
   type: 'dialogue',
   render(session) {
      const state = dialogueStateFrom(session.state);

      return dialogueProgress(state) === 'ongoing'
         ? nodeView(session, state)
         // Crash-recovery window: the ending pick was persisted but the cleanup
         // may not have run. Offer to finish it.
         : farewellView(session, state);
   },
   async onAction(client, interaction, session, actor, action, args) {
      if (!interaction.isButton())
         return;

      if (action === 'opt') return handleOption(interaction, session, actor, args[0]);
      if (action === 'finalize') return finalize(interaction, session, actor, dialogueStateFrom(session.state));
      if (action === 'leave') return handleLeave(interaction, session, actor);
   },
} satisfies ActivityHandler;

async function handleOption(
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
   optionId: string,
): Promise<void> {
   const state = dialogueStateFrom(session.state);
   if (dialogueProgress(state) !== 'ongoing') {
      await finalize(interaction, session, actor, state);
      return;
   }

   const node = dialogueNodeOf(state);
   const option = node?.options.find((candidate) => candidate.id === optionId);
   if (!node || !option) {
      // A stale button (a picked one-shot, or a renamed dialogue/node id) —
      // repaint whatever is authoritative now (D10 rule 3).
      await repaintCurrent(interaction, session._id);
      return;
   }

   // Re-validate at click time: a spent one-shot or an unmet gate means the
   // button came from a stale panel — never trust the customId alone.
   const spent = state.spentOptionKeys.includes(dialogueOptionKey(state.nodeId, option.id));
   if (spent || !dialogueGateCheck(option, state).ok) {
      await repaintCurrent(interaction, session._id);
      return;
   }

   // A rolled line is a meaningful action and costs AP (🟡); the actual spend
   // lands only after the step-guard win, so a lost double-click race charges
   // nothing (being session-busy blocks every OTHER AP spender, which is what
   // makes the post-guard spend safe).
   if (option.check && !canCharacterAct(actor, DIALOGUE_CHECK_AP_COST).ok) {
      await interaction.update(nodeView(session, state, `🔒 That line takes composure you cannot spare (${DIALOGUE_CHECK_AP_COST} AP).`));
      return;
   }

   // Roll against the target computed (and shown) when the session opened;
   // fall back to a fresh computation for hand-edited blobs (D26/D28 pattern).
   const check = option.check
      ? rollAgainst(state.optionTargets[dialogueOptionKey(state.nodeId, option.id)] ?? checkTarget({ ...actor, attributes: attributesWithEquipment(actor) }, option.check))
      : null;
   const success = check?.success ?? true;
   const outcome = appliedDialogueOutcome(option, success);
   const spoken = outcome.lines ? randomItem(outcome.lines) : '';
   const line = [spoken, check ? `(🎲 ${check.roll} vs **${check.target}%** — ${check.success ? 'success' : 'failure'})` : '']
      .filter(Boolean).join(' ');

   const next = pickDialogueOption(state, state.nodeId, option, success, line);
   const advanced = await activitySessionService.advance(session._id, session.step, { ...next });
   if (!advanced) {
      // Stale click (double-click or replay) — repaint whatever is authoritative now.
      await repaintCurrent(interaction, session._id);
      return;
   }

   // Winning the step guard means this pick is committed exactly once, so the
   // side writes ride with it (the challenge handler's argument verbatim: a
   // crash right here loses at most one small delta — accepted).
   if (check && !await characterService.spendActionPoints(actor._id, DIALOGUE_CHECK_AP_COST))
      log.warn(`Dialogue check AP spend failed for ${actor._id} (session ${session._id}) — rolled uncharged.`);

   if (outcome.effects?.traits)
      await characterService.applyTraitDeltas(actor._id, outcome.effects.traits);

   // Learn-by-doing (D40): a ROLLED check trains its skill path, success or
   // failure alike, weighted by how hard the attempt was for this character.
   let trainingNote = '';
   if (check && option.check?.node) {
      const levelUps = await characterService.creditSkillUse(actor._id, [option.check.node], checkTrainingWeight(check.target));
      if (levelUps.length > 0)
         trainingNote = trainingLine(levelUps);
   }

   if (dialogueProgress(next) === 'ongoing') {
      await interaction.update(nodeView(advanced, next, trainingNote));
      return;
   }

   // We won the guard on the ending pick, so completion is ours to run.
   await finalize(interaction, advanced, actor, next, trainingNote);
}

/** The idempotent completion tail: delete the session → repaint the HUB where
 *  the character stands, with the parting line as the banner (D30). A mundane
 *  chat is nobody's news — no chronicle (D24 reserves it for the noteworthy). */
async function finalize(
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
   state: DialogueState,
   trainingNote = '',
): Promise<void> {
   await activitySessionService.complete(session._id);

   const survivor = await characterService.get(actor._id);
   const banner = [
      `💬 You part ways with **${npcName(state.npcCharacterId)}**.`,
      state.lastLine ? `_${state.lastLine}_` : '',
      trainingNote,
   ].filter(Boolean).join('\n');

   await interaction.update(survivor ? await freshHubView(survivor, banner) : { content: banner, embeds: [], components: [] });
}

/** Walking away mid-talk (D17 clean cancel): nothing to refund — starting a
 *  conversation is free, and rolled options were charged as they happened. */
async function handleLeave(
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
): Promise<void> {
   const state = dialogueStateFrom(session.state);

   await activitySessionService.abandon(session._id);

   const survivor = await characterService.get(actor._id);
   const banner = `💬 You excuse yourself — **${npcName(state.npcCharacterId)}** has already turned back to their own affairs.`;
   await interaction.update(survivor ? await freshHubView(survivor, banner) : { content: banner, embeds: [], components: [] });
}

async function repaintCurrent(interaction: ButtonInteraction, sessionId: string): Promise<void> {
   const fresh = await activitySessionService.get(sessionId);

   if (fresh?.status !== 'active') {
      await interaction.update({ content: 'This conversation has already ended.', embeds: [], components: [] });
      return;
   }

   const state = dialogueStateFrom(fresh.state);
   await interaction.update(dialogueProgress(state) === 'ongoing' ? nodeView(fresh, state) : farewellView(fresh, state));
}

// --- Views --------------------------------------------------------------------

function nodeView(session: ActivitySessionDoc, state: DialogueState, note = ''): ActivityView {
   const node = dialogueNodeOf(state);

   // A retired dialogue/node id (D10 rule 3): the talk gracefully trails off.
   if (!node) {
      const embed = new EmbedBuilder()
         .setColor(DIALOGUE_COLOR)
         .setTitle(`💬 ${npcTitle(state.npcCharacterId)}`)
         .setDescription(`**${npcName(state.npcCharacterId)}** seems to have lost the thread of the conversation.`);
      return { embeds: [embed], components: [leaveRow(session._id, 'Take your leave')] };
   }

   const options = availableDialogueOptions(state.nodeId, node, state);
   const optionLines = options.map(({ option, ok, reason }) => {
      if (!ok)
         return `🔒 **${option.label}** — ${reason}.`;

      const target = option.check ? state.optionTargets[dialogueOptionKey(state.nodeId, option.id)] : undefined;
      return `${option.emoji} **${option.label}**${target !== undefined ? ` (**${target}%**, ${DIALOGUE_CHECK_AP_COST} AP)` : ''}`;
   });

   const embed = new EmbedBuilder()
      .setColor(DIALOGUE_COLOR)
      .setTitle(`💬 ${npcTitle(state.npcCharacterId)}`)
      .setDescription([
         // What was just said/rolled rides the state (replay-safe), above the
         // NPC's current line — a repaint rebuilds this exactly.
         state.lastLine ? `_${state.lastLine}_\n` : '',
         fillDialogueLine(node.line, state.npcCharacterId),
         // Rides only the pick that earned it — repaints stay quiet.
         note,
         optionLines.length > 0 ? `\n${optionLines.join('\n')}` : '',
         '⏳ Walk away for too long and the conversation ends on its own.',
      ].filter(Boolean).join('\n'));

   return { embeds: [embed], components: optionRows(session._id, options) };
}

function farewellView(session: ActivitySessionDoc, state: DialogueState): ActivityView {
   const embed = new EmbedBuilder()
      .setColor(DIALOGUE_COLOR)
      .setTitle(`💬 ${npcTitle(state.npcCharacterId)}`)
      .setDescription([
         state.lastLine ? `_${state.lastLine}_\n` : '',
         `The conversation with **${npcName(state.npcCharacterId)}** has run its course.`,
      ].filter(Boolean).join('\n'));

   const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`activity:finalize:${session._id}`).setLabel('Part ways').setEmoji('👋').setStyle(ButtonStyle.Primary),
   );

   return { embeds: [embed], components: [row] };
}

/** One button per available line + Walk away, chunked into ≤5-wide rows.
 *  Locked options are listed in the embed (with why) but get no button. */
function optionRows(sessionId: string, options: readonly AvailableDialogueOption[]): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
   const buttons = [
      ...options.filter(({ ok }) => ok).map(({ option }) =>
         new ButtonBuilder().setCustomId(`activity:opt:${sessionId}:${option.id}`).setLabel(option.label).setEmoji(option.emoji).setStyle(ButtonStyle.Primary),
      ),
      new ButtonBuilder().setCustomId(`activity:leave:${sessionId}`).setLabel('Walk away').setEmoji('🚶').setStyle(ButtonStyle.Secondary),
   ];

   const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
   for (let i = 0; i < buttons.length; i += 5)
      rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons.slice(i, i + 5)));

   return rows;
}

function leaveRow(sessionId: string, label: string): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`activity:leave:${sessionId}`).setLabel(label).setEmoji('🚶').setStyle(ButtonStyle.Secondary),
   );
}

/** Second-person "you improved" note (the challenge handler's sibling). */
function trainingLine(levelUps: readonly SkillLevelUp[]): string {
   const gains = levelUps.map((up) => `**${skillNode(up.node).name}** rises to **${up.to}**`).join(', ');
   return `📈 The exchange taught you something — ${gains}.`;
}

/** Roster name with a graceful unknown-id fallback (D10 rule 3). */
function npcName(npcCharacterId: string): string {
   return npcDefinition(npcCharacterId)?.name ?? 'the stranger';
}

function npcTitle(npcCharacterId: string): string {
   const npc = npcDefinition(npcCharacterId);
   return npc ? `${npc.name}, ${npc.epithet}` : 'A stranger';
}
