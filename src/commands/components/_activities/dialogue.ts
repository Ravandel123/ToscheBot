// Discord adapter (marked): the 'dialogue' activity handler — a conversation
// with an NPC, run on the challenge handler's shape:
//   * each pick = one step-guarded `advance` (idempotent against double-clicks
//     and crash-replay); the outcome line + roll summary ride IN the state so
//     repaints are stable;
//   * terminal picks: commit the final state via `advance` (winning the guard =
//     owning completion), THEN the idempotent tail (nothing but cleanup here —
//     trait/skill writes ride the winning pick itself), THEN delete the
//     session; a crash in between leaves a farewell view with a "Part ways"
//     finalize re-entry.
// Rolled options charge DIALOGUE_CHECK_AP_COST and train their node's path;
// checkless lines are free. The NPC is not a participant — see
// game/activity/dialogue.ts for the two v1 shape decisions.
import { ButtonBuilder, ButtonStyle, EmbedBuilder, type ButtonInteraction } from 'discord.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { hubAfter, optionRows, repaintSession, rollSummary, takeExit, trainFromCheck } from './shared.js';
import { characterService } from '../../../db/services/characterService.js';
import {
   appliedDialogueOutcome,
   availableDialogueOptions,
   dialogueGateCheck,
   dialogueNodeOf,
   dialogueOf,
   dialogueOptionKey,
   dialogueProgress,
   dialogueStateFrom,
   DIALOGUE_CHECK_AP_COST,
   fillDialogueLine,
   pickDialogueOption,
   type DialogueState,
} from '../../../game/activity/dialogue.js';
import { canCharacterAct } from '../../../game/character/rules.js';
import { checkSubject } from '../../../game/character/modifiers.js';
import { npcDefinition } from '../../../game/data/npcs.js';
import { checkTarget, rollAgainst } from '../../../game/checks.js';
import { randomItem } from '../../../lib/random.js';
import { log } from '../../../lib/log.js';
import { actionRow } from '../../../lib/discord.js';
import type { ActivityExit } from '../../../game/activity/exit.js';
import type { ActivityHandler, ActivityView } from '../../../types/activities.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';
import type { CharacterDoc } from '../../../db/models/character.js';

const DIALOGUE_COLOR = 0x8A6D9B; // tavern-candle violet

/** For a session whose dialogue id no longer resolves. */
const FALLBACK_EXIT: ActivityExit = { label: 'Take your leave', emoji: '🚶', lines: ['You take your leave.'] };

const ENDED_LINE = 'This conversation has already ended.';

function render(session: ActivitySessionDoc): ActivityView {
   const state = dialogueStateFrom(session.state);

   return dialogueProgress(state) === 'ongoing'
      ? nodeView(session, state)
      // Crash-recovery window: the ending pick was persisted but the cleanup
      // may not have run. Offer to finish it.
      : farewellView(session, state);
}

export default {
   type: 'dialogue',
   render,
   title(session) {
      return `A conversation with ${npcName(dialogueStateFrom(session.state).npcCharacterId)}`;
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
      // repaint whatever is authoritative now.
      await repaintSession(interaction, session._id, render, ENDED_LINE);
      return;
   }

   // Re-validate at click time: a spent one-shot or an unmet gate means the
   // button came from a stale panel — never trust the customId alone.
   const spent = state.spentOptionKeys.includes(dialogueOptionKey(state.nodeId, option.id));
   if (spent || !dialogueGateCheck(option, state).ok) {
      await repaintSession(interaction, session._id, render, ENDED_LINE);
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
   // fall back to a fresh computation for a state that lacks it.
   const check = option.check
      ? rollAgainst(state.optionTargets[dialogueOptionKey(state.nodeId, option.id)] ?? checkTarget(checkSubject(actor), option.check))
      : null;
   const success = check?.success ?? true;
   const outcome = appliedDialogueOutcome(option, success);
   const spoken = outcome.lines ? randomItem(outcome.lines) : '';
   const line = [spoken, check ? rollSummary(check) : '']
      .filter(Boolean).join(' ');

   const next = pickDialogueOption(state, state.nodeId, option, success, line);
   const advanced = await activitySessionService.advance(session._id, session.step, { ...next });
   if (!advanced) {
      // Stale click (double-click or replay) — repaint whatever is authoritative now.
      await repaintSession(interaction, session._id, render, ENDED_LINE);
      return;
   }

   // Winning the step guard means this pick is committed exactly once, so the
   // side writes ride with it (the challenge handler's argument verbatim: a
   // crash right here loses at most one small delta — accepted).
   if (check && !await characterService.spendActionPoints(actor._id, DIALOGUE_CHECK_AP_COST))
      log.warn(`Dialogue check AP spend failed for ${actor._id} (session ${session._id}) — rolled uncharged.`);

   if (outcome.effects?.traits)
      await characterService.applyTraitDeltas(actor._id, outcome.effects.traits);

   const trainingNote = await trainFromCheck(actor._id, option.check, check, 'The exchange taught you something');

   if (dialogueProgress(next) === 'ongoing') {
      await interaction.update(nodeView(advanced, next, trainingNote));
      return;
   }

   // We won the guard on the ending pick, so completion is ours to run.
   await finalize(interaction, advanced, actor, next, trainingNote);
}

/** The idempotent completion tail: delete the session → repaint the HUB where
 *  the character stands, with the parting line as the banner. A mundane chat
 *  is nobody's news — no chronicle. */
async function finalize(
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
   state: DialogueState,
   trainingNote = '',
): Promise<void> {
   await activitySessionService.complete(session._id);

   const banner = [
      `💬 You part ways with **${npcName(state.npcCharacterId)}**.`,
      state.lastLine ? `_${state.lastLine}_` : '',
      trainingNote,
   ].filter(Boolean).join('\n');

   await interaction.update(await hubAfter(actor._id, banner));
}

/** Cutting the talk short by the dialogue's exit — the rude way out, next to
 *  the polite goodbyes each node offers. Nothing to refund: starting a
 *  conversation is free and rolled lines were charged as they happened. */
async function handleLeave(
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
): Promise<void> {
   const state = dialogueStateFrom(session.state);

   // A stale panel must not turn an already-finished talk into an insult.
   if (dialogueProgress(state) !== 'ongoing') {
      await finalize(interaction, session, actor, state);
      return;
   }

   const exit = dialogueOf(state)?.exit ?? FALLBACK_EXIT;
   await takeExit(session, actor._id, exit);
   await interaction.update(await hubAfter(actor._id, `${exit.emoji} ${fillDialogueLine(randomItem(exit.lines), state.npcCharacterId)}`));
}

// --- Views --------------------------------------------------------------------

function nodeView(session: ActivitySessionDoc, state: DialogueState, note = ''): ActivityView {
   const node = dialogueNodeOf(state);

   // A retired dialogue/node id: the talk gracefully trails off.
   if (!node) {
      const embed = new EmbedBuilder()
         .setColor(DIALOGUE_COLOR)
         .setTitle(`💬 ${npcTitle(state.npcCharacterId)}`)
         .setDescription(`**${npcName(state.npcCharacterId)}** seems to have lost the thread of the conversation.`);
      return { embeds: [embed], components: optionRows(session._id, [], 'leave', FALLBACK_EXIT) };
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
      ].filter(Boolean).join('\n'));

   // Locked options are listed in the embed (with why) but get no button.
   const open = options.filter(({ ok }) => ok).map(({ option }) => option);
   return { embeds: [embed], components: optionRows(session._id, open, 'leave', dialogueOf(state)?.exit ?? FALLBACK_EXIT) };
}

function farewellView(session: ActivitySessionDoc, state: DialogueState): ActivityView {
   const embed = new EmbedBuilder()
      .setColor(DIALOGUE_COLOR)
      .setTitle(`💬 ${npcTitle(state.npcCharacterId)}`)
      .setDescription([
         state.lastLine ? `_${state.lastLine}_\n` : '',
         `The conversation with **${npcName(state.npcCharacterId)}** has run its course.`,
      ].filter(Boolean).join('\n'));

   const row = actionRow(
      new ButtonBuilder().setCustomId(`activity:finalize:${session._id}`).setLabel('Part ways').setEmoji('👋').setStyle(ButtonStyle.Primary),
   );

   return { embeds: [embed], components: [row] };
}

/** Roster name with a graceful unknown-id fallback. */
function npcName(npcCharacterId: string): string {
   return npcDefinition(npcCharacterId)?.name ?? 'the stranger';
}

function npcTitle(npcCharacterId: string): string {
   const npc = npcDefinition(npcCharacterId);
   return npc ? `${npc.name}, ${npc.epithet}` : 'A stranger';
}
