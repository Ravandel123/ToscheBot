// Discord adapter (marked): the 'challenge' activity handler — the reference
// pattern for every interactive activity:
//   * each click = one step-guarded `advance` (idempotent against double-clicks
//     and crash-replay); flavor + roll summary ride IN the state so repaints
//     are stable;
//   * terminal steps: commit the final state via `advance` (winning the guard =
//     owning completion), THEN side effects (move, chronicle), THEN delete the
//     session — if the bot dies in between, `render` sees a terminal state and
//     offers a "Press on" finalize button that redoes the idempotent tail.
// Each approach is a d100 roll-under check (game/checks.ts) against a target
// computed when the session opened — the panel shows your % honestly.
import { ButtonBuilder, ButtonStyle, EmbedBuilder, type ButtonInteraction } from 'discord.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { hubAfter, optionRows, repaintSession, rollSummary, takeExit, trainFromCheck } from './shared.js';
import { characterService } from '../../../db/services/characterService.js';
import { locationStateService } from '../../../db/services/locationStateService.js';
import { revealFeature } from '../_hubView.js';
import { postChronicle } from '../../../game/chronicle.js';
import { displayName } from '../../../game/character/identity.js';
import { locationName } from '../../../game/data/locations.js';
import { ENCOUNTERS, type ActivityEncounter, type EncounterId } from '../../../game/data/encounters.js';
import {
   appliedOutcome,
   attemptChallenge,
   availableOptions,
   challengeProgress,
   challengeStateFrom,
   type ChallengeState,
} from '../../../game/activity/challenge.js';
import { checkTarget, rollAgainst } from '../../../game/checks.js';
import { checkSubject } from '../../../game/character/modifiers.js';
import { randomItem } from '../../../lib/random.js';
import { actionRow } from '../../../lib/discord.js';
import type { ActivityExit } from '../../../game/activity/exit.js';
import type { ActivityHandler, ActivityView } from '../../../types/activities.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';
import type { CharacterDoc } from '../../../db/models/character.js';
import type { ToscheClient } from '../../../client.js';

const CHALLENGE_COLOR = 0x7A5C3E; // weathered timber

/** For a session whose encounter id no longer resolves. */
const FALLBACK_EXIT: ActivityExit = { label: 'Turn back', emoji: '↩️', lines: ['You turn back the way you came.'] };

const ENDED_LINE = 'This activity has already ended.';

function render(session: ActivitySessionDoc): ActivityView {
   const state = challengeStateFrom(session.state);

   return challengeProgress(state) === 'ongoing'
      ? stepView(session, state)
      // Crash-recovery window: the final step was persisted but the tail
      // (move/cleanup) may not have run. Offer to finish it.
      : finalizeView(session, state);
}

export default {
   type: 'challenge',
   render,
   title(session) {
      const state = challengeStateFrom(session.state);
      return `${encounterName(state.encounterId)}, on the road to ${locationName(state.toId)}`;
   },
   async onAction(client, interaction, session, actor, action, args) {
      if (!interaction.isButton())
         return;

      if (action === 'opt') return handleOption(client, interaction, session, actor, args[0]);
      if (action === 'finalize') return finalize(client, interaction, session, actor, challengeStateFrom(session.state));
      if (action === 'retreat') return handleExit(client, interaction, session, actor);
   },
} satisfies ActivityHandler;

async function handleOption(
   client: ToscheClient,
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
   optionId: string,
): Promise<void> {
   const state = challengeStateFrom(session.state);
   if (challengeProgress(state) !== 'ongoing') {
      await finalize(client, interaction, session, actor, state);
      return;
   }

   const encounter = activityEncounter(state.encounterId);
   const option = encounter && availableOptions(encounter.options, state).find((o) => o.id === optionId);
   if (!encounter || !option) {
      // A stale button (burned one-shot, or a renamed encounter/option id) —
      // repaint whatever is authoritative now.
      await repaintSession(interaction, session._id, render, ENDED_LINE);
      return;
   }

   // Roll against the target computed (and shown) when the session opened;
   // fall back to a fresh computation for a state that lacks it.
   const check = option.check
      ? rollAgainst(state.optionTargets[option.id] ?? checkTarget(checkSubject(actor), option.check))
      : null;
   const success = check?.success ?? true;
   const outcome = appliedOutcome(option, success);
   const line = randomItem(outcome.lines) + (check ? ` ${rollSummary(check)}` : '');

   const next = attemptChallenge(state, option, success, line, encounter.maxSetbacks);
   const advanced = await activitySessionService.advance(session._id, session.step, { ...next });
   if (!advanced) {
      // Stale click (double-click or replay) — repaint whatever is authoritative now.
      await repaintSession(interaction, session._id, render, ENDED_LINE);
      return;
   }

   // Winning the step guard means this attempt is committed exactly once, so
   // the trait deltas ride with it (a crash right here loses at most one +1 —
   // accepted; traits are flavor meters, not currency).
   if (outcome.traits)
      await characterService.applyTraitDeltas(actor._id, outcome.traits);

   // Learn-by-doing, weighted by how hard the attempt was for this character.
   // The step-guard win serializes this write: a session-busy character cannot
   // equip, duel or switch, so no other progression writer can interleave.
   const trainingNote = await trainFromCheck(actor._id, option.check, check, 'The attempt taught you something');

   // Some outcomes reveal a feature of the destination — idempotent, and
   // it announces itself to the chronicle only when genuinely new.
   if (outcome.discovers)
      await revealFeature(client, actor, next.toId, outcome.discovers);

   if (challengeProgress(next) === 'ongoing') {
      await interaction.update(stepView(advanced, next, trainingNote));
      return;
   }

   // We won the guard on the terminal step, so completion is ours to run.
   await finalize(client, interaction, advanced, actor, next, trainingNote);
}

/** The idempotent completion tail: move (only on 'proceed') → delete session →
 *  repaint the HUB at wherever the character ended up, so the play loop
 *  continues without a fresh `/play` → chronicle. `trainingNote` rides only
 *  the attempt that just credited it — a crash-replay re-entry passes none. */
async function finalize(
   client: ToscheClient,
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
   state: ChallengeState,
   trainingNote = '',
): Promise<void> {
   const proceeded = challengeProgress(state) === 'proceed';
   const name = displayName(actor);
   const challenge = encounterName(state.encounterId);

   if (proceeded) {
      await characterService.setLocation(actor._id, state.toId);
      await locationStateService.recordVisit(state.toId);
   }

   await activitySessionService.complete(session._id);

   const outcomeLine = proceeded
      ? `✅ ${state.lastLine || 'You press on.'}\nYou arrive at **${locationName(state.toId)}**.`
      : `❌ ${challenge} proves too much — you trudge back to **${locationName(state.fromId)}**.`;
   await interaction.update(await hubAfter(actor._id, trainingNote ? `${outcomeLine}\n${trainingNote}` : outcomeLine));

   await postChronicle(client, proceeded
      ? `🧭 **${name}** reached **${locationName(state.toId)}**, getting past ${challenge.toLowerCase()} on the way.`
      : `🧭 **${name}** set out for **${locationName(state.toId)}**, but ${challenge.toLowerCase()} forced them back to **${locationName(state.fromId)}**.`);
}

/** Taking the encounter's exit. */
async function handleExit(
   client: ToscheClient,
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
): Promise<void> {
   const state = challengeStateFrom(session.state);

   // A stale panel must not turn an already-won crossing into a retreat.
   if (challengeProgress(state) !== 'ongoing') {
      await finalize(client, interaction, session, actor, state);
      return;
   }

   const exit = activityEncounter(state.encounterId)?.exit ?? FALLBACK_EXIT;
   await takeExit(session, actor._id, exit);
   await interaction.update(await hubAfter(actor._id, `${exit.emoji} ${randomItem(exit.lines)}\nYou are back at **${locationName(state.fromId)}**.`));
}

// --- Views --------------------------------------------------------------------

function stepView(session: ActivitySessionDoc, state: ChallengeState, trainingNote = ''): ActivityView {
   const encounter = activityEncounter(state.encounterId);
   const options = encounter ? availableOptions(encounter.options, state) : [];

   const optionLines = options.map((option) => {
      const target = option.check ? state.optionTargets[option.id] : undefined;
      return `${option.emoji} **${option.label}** — ${option.description}${target !== undefined ? ` (**${target}%**)` : ''}`;
   });

   const embed = new EmbedBuilder()
      .setColor(CHALLENGE_COLOR)
      .setTitle(`⚠️ ${encounterName(state.encounterId)} — on the road to ${locationName(state.toId)}`)
      .setDescription([
         encounter?.intro ?? 'Something stands in the way.',
         state.lastLine ? `\n_${state.lastLine}_` : '',
         // Rides only the attempt that earned it — a repaint (stale click,
         // re-entry) rebuilds from state alone and stays quiet.
         trainingNote,
         optionLines.length > 0 ? `\n${optionLines.join('\n')}` : '',
         encounter ? `\nSetbacks: **${state.setbacks}/${encounter.maxSetbacks}**` : '',
      ].filter(Boolean).join('\n'));

   return { embeds: [embed], components: optionRows(session._id, options, 'retreat', encounter?.exit ?? FALLBACK_EXIT) };
}

function finalizeView(session: ActivitySessionDoc, state: ChallengeState): ActivityView {
   const proceeded = challengeProgress(state) === 'proceed';
   const embed = new EmbedBuilder()
      .setColor(CHALLENGE_COLOR)
      .setTitle(`⚠️ ${encounterName(state.encounterId)}`)
      .setDescription(proceeded
         ? `You are past the worst of it — **${locationName(state.toId)}** lies ahead.`
         : `It bested you this time. The road back to **${locationName(state.fromId)}** awaits.`);

   const row = actionRow(
      new ButtonBuilder().setCustomId(`activity:finalize:${session._id}`).setLabel('Press on').setEmoji('🥾').setStyle(ButtonStyle.Primary),
   );

   return { embeds: [embed], components: [row] };
}

/** The encounter behind a state, if it still exists and is activity-kind. */
function activityEncounter(encounterId: string): ActivityEncounter | undefined {
   const encounter = ENCOUNTERS[encounterId as EncounterId];
   return encounter?.kind === 'activity' ? encounter : undefined;
}

/** Encounter display name with a graceful unknown-id fallback. */
function encounterName(encounterId: string): string {
   return ENCOUNTERS[encounterId as EncounterId]?.name ?? 'An obstacle';
}
