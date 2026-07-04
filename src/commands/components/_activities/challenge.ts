// Discord adapter (marked): the 'challenge' activity handler — the multi-
// approach successor of the old single-button 'obstacle' (D26) and still the
// reference pattern for every future interactive activity:
//   * each click = one step-guarded `advance` (idempotent against double-clicks
//     and crash-replay); flavor + roll summary ride IN the state so repaints
//     are stable;
//   * terminal steps: commit the final state via `advance` (winning the guard =
//     owning completion), THEN side effects (move, chronicle), THEN delete the
//     session — if the bot dies in between, `render` sees a terminal state and
//     offers a "Press on" finalize button that redoes the idempotent tail.
// Each approach is a d100 roll-under check (game/checks.ts) against a target
// computed when the session opened — the panel shows your % honestly (R1).
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type ButtonInteraction, type MessageActionRowComponentBuilder } from 'discord.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { characterService } from '../../../db/services/characterService.js';
import { locationStateService } from '../../../db/services/locationStateService.js';
import { freshHubView, revealFeature } from '../_hubView.js';
import { postChronicle } from '../../../game/chronicle.js';
import { displayName } from '../../../game/character/identity.js';
import { locationName } from '../../../game/data/locations.js';
import { ENCOUNTERS, type ActivityEncounter, type ChallengeOption, type EncounterId } from '../../../game/data/encounters.js';
import {
   appliedOutcome,
   attemptChallenge,
   availableOptions,
   challengeProgress,
   challengeStateFrom,
   type ChallengeState,
} from '../../../game/activity/challenge.js';
import { checkTarget, rollAgainst } from '../../../game/checks.js';
import { attributesWithEquipment } from '../../../game/character/inventory.js';
import { randomItem } from '../../../lib/random.js';
import type { ActivityHandler, ActivityView } from '../../../types/activities.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';
import type { CharacterDoc } from '../../../db/models/character.js';
import type { ToscheClient } from '../../../client.js';

const CHALLENGE_COLOR = 0x7A5C3E; // weathered timber

export default {
   type: 'challenge',
   render(session) {
      const state = challengeStateFrom(session.state);

      return challengeProgress(state) === 'ongoing'
         ? stepView(session, state)
         // Crash-recovery window: the final step was persisted but the tail
         // (move/cleanup) may not have run. Offer to finish it.
         : finalizeView(session, state);
   },
   async onAction(client, interaction, session, actor, action, args) {
      if (!interaction.isButton())
         return;

      if (action === 'opt') return handleOption(client, interaction, session, actor, args[0]);
      if (action === 'finalize') return finalize(client, interaction, session, actor, challengeStateFrom(session.state));
      if (action === 'retreat') return handleRetreat(interaction, session, actor);
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
      // repaint whatever is authoritative now (D10 rule 3).
      await repaintCurrent(interaction, session._id);
      return;
   }

   // Roll against the target computed (and shown) when the session opened;
   // fall back to a fresh computation for pre-D26 blobs (with equipped-gear
   // modifiers applied, like the session-start computation — D28).
   const check = option.check
      ? rollAgainst(state.optionTargets[option.id] ?? checkTarget({ ...actor, attributes: attributesWithEquipment(actor) }, option.check))
      : null;
   const success = check?.success ?? true;
   const outcome = appliedOutcome(option, success);
   const line = randomItem(outcome.lines) + (check ? ` (🎲 ${check.roll} vs **${check.target}%** — ${check.success ? 'success' : 'failure'})` : '');

   const next = attemptChallenge(state, option, success, line, encounter.maxSetbacks);
   const advanced = await activitySessionService.advance(session._id, session.step, { ...next });
   if (!advanced) {
      // Stale click (double-click or replay) — repaint whatever is authoritative now.
      await repaintCurrent(interaction, session._id);
      return;
   }

   // Winning the step guard means this attempt is committed exactly once, so
   // the trait deltas ride with it (a crash right here loses at most one +1 —
   // accepted; traits are flavor meters, not currency).
   if (outcome.traits)
      await characterService.applyTraitDeltas(actor._id, outcome.traits);

   // Some outcomes reveal a feature of the destination (D31) — idempotent, and
   // it announces itself to the chronicle only when genuinely new.
   if (outcome.discovers)
      await revealFeature(client, actor, next.toId, outcome.discovers);

   if (challengeProgress(next) === 'ongoing') {
      await interaction.update(stepView(advanced, next));
      return;
   }

   // We won the guard on the terminal step, so completion is ours to run.
   await finalize(client, interaction, advanced, actor, next);
}

/** The idempotent completion tail: move (only on 'proceed') → chronicle → delete
 *  session → repaint the HUB at wherever the character ended up, so the play
 *  loop continues without a fresh `/play` (D30/D31). */
async function finalize(
   client: ToscheClient,
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
   state: ChallengeState,
): Promise<void> {
   const proceeded = challengeProgress(state) === 'proceed';
   const name = displayName(actor);
   const challenge = encounterName(state.encounterId);

   if (proceeded) {
      await characterService.setLocation(actor._id, state.toId);
      await locationStateService.recordVisit(state.toId);
   }

   await activitySessionService.complete(session._id);

   const survivor = await characterService.get(actor._id);
   const banner = proceeded
      ? `✅ ${state.lastLine || 'You press on.'}\nYou arrive at **${locationName(state.toId)}**.`
      : `❌ ${challenge} proves too much — you trudge back to **${locationName(state.fromId)}**.`;
   await interaction.update(survivor ? await freshHubView(survivor, banner) : { content: banner, embeds: [], components: [] });

   await postChronicle(client, proceeded
      ? `🧭 **${name}** reached **${locationName(state.toId)}**, getting past ${challenge.toLowerCase()} on the way.`
      : `🧭 **${name}** set out for **${locationName(state.toId)}**, but ${challenge.toLowerCase()} forced them back to **${locationName(state.fromId)}**.`);
}

/** Clean cancel (D17): any AP refund would go here — travel is free for now (D14 placeholder). */
async function handleRetreat(
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
): Promise<void> {
   const state = challengeStateFrom(session.state);

   await activitySessionService.abandon(session._id);

   const survivor = await characterService.get(actor._id);
   const banner = `↩️ You think better of it and turn back toward **${locationName(state.fromId)}**.`;
   await interaction.update(survivor ? await freshHubView(survivor, banner) : { content: banner, embeds: [], components: [] });
}

async function repaintCurrent(interaction: ButtonInteraction, sessionId: string): Promise<void> {
   const fresh = await activitySessionService.get(sessionId);

   if (!fresh || fresh.status !== 'active') {
      await interaction.update({ content: 'This activity has already ended.', embeds: [], components: [] });
      return;
   }

   const state = challengeStateFrom(fresh.state);
   await interaction.update(challengeProgress(state) === 'ongoing' ? stepView(fresh, state) : finalizeView(fresh, state));
}

// --- Views --------------------------------------------------------------------

function stepView(session: ActivitySessionDoc, state: ChallengeState): ActivityView {
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
         optionLines.length > 0 ? `\n${optionLines.join('\n')}` : '',
         encounter ? `\nSetbacks: **${state.setbacks}/${encounter.maxSetbacks}**` : '',
         '⏳ Walk away for too long and you will give up the crossing.',
      ].filter(Boolean).join('\n'));

   return { embeds: [embed], components: optionRows(session._id, options) };
}

function finalizeView(session: ActivitySessionDoc, state: ChallengeState): ActivityView {
   const proceeded = challengeProgress(state) === 'proceed';
   const embed = new EmbedBuilder()
      .setColor(CHALLENGE_COLOR)
      .setTitle(`⚠️ ${encounterName(state.encounterId)}`)
      .setDescription(proceeded
         ? `You are past the worst of it — **${locationName(state.toId)}** lies ahead.`
         : `It bested you this time. The road back to **${locationName(state.fromId)}** awaits.`);

   const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`activity:finalize:${session._id}`).setLabel('Press on').setEmoji('🥾').setStyle(ButtonStyle.Primary),
   );

   return { embeds: [embed], components: [row] };
}

/** One button per available approach + Turn back, chunked into ≤5-wide rows. */
function optionRows(sessionId: string, options: readonly ChallengeOption[]): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
   const buttons = [
      ...options.map((option) =>
         new ButtonBuilder().setCustomId(`activity:opt:${sessionId}:${option.id}`).setLabel(option.label).setEmoji(option.emoji).setStyle(ButtonStyle.Primary),
      ),
      new ButtonBuilder().setCustomId(`activity:retreat:${sessionId}`).setLabel('Turn back').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
   ];

   const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
   for (let i = 0; i < buttons.length; i += 5)
      rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons.slice(i, i + 5)));

   return rows;
}

/** The encounter behind a state, if it still exists and is activity-kind (D10 rule 3). */
function activityEncounter(encounterId: string): ActivityEncounter | undefined {
   const encounter = ENCOUNTERS[encounterId as EncounterId];
   return encounter?.kind === 'activity' ? encounter : undefined;
}

/** Encounter display name with a graceful unknown-id fallback (D10 rule 3). */
function encounterName(encounterId: string): string {
   return ENCOUNTERS[encounterId as EncounterId]?.name ?? 'An obstacle';
}
