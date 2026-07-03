// Discord adapter (marked): the 'obstacle' activity handler — the first real
// consumer of the D17 durability stack and the reference pattern for every
// future interactive activity (duel, NPC talk, exploration):
//   * each click = one step-guarded `advance` (idempotent against double-clicks
//     and crash-replay); flavor rides IN the state so repaints are stable;
//   * terminal steps: commit the final state via `advance` (winning the guard =
//     owning completion), THEN side effects (move, chronicle), THEN delete the
//     session — if the bot dies in between, `render` sees a terminal state and
//     offers a "Press on" finalize button that redoes the idempotent tail.
// Mechanics are PLACEHOLDER pure-random (D14/D16) — no stats, no damage.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type ButtonInteraction, type MessageActionRowComponentBuilder } from 'discord.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { characterService } from '../../../db/services/characterService.js';
import { postChronicle } from '../../../game/chronicle.js';
import { displayName } from '../../../game/character/identity.js';
import { locationName } from '../../../game/data/locations.js';
import { ENCOUNTERS, type EncounterId } from '../../../game/data/encounters.js';
import {
   OBSTACLE_PROGRESS_TO_CLEAR,
   OBSTACLE_SETBACKS_TO_FAIL,
   OBSTACLE_SUCCESS_PERCENT,
   attemptObstacle,
   obstacleOutcome,
   obstacleStateFrom,
   type ObstacleState,
} from '../../../game/activity/obstacle.js';
import { chance, randomItem } from '../../../lib/random.js';
import type { ActivityHandler, ActivityView } from '../../../types/activities.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';
import type { CharacterDoc } from '../../../db/models/character.js';
import type { ToscheClient } from '../../../client.js';

const OBSTACLE_COLOR = 0x7A5C3E; // weathered timber

// PLACEHOLDER attempt flavor — generic enough for any physical obstacle.
const SUCCESS_LINES = [
   'You find a solid hold and haul yourself up.',
   'A running start pays off — you gain ground.',
   'You wedge a boot in and push higher.',
] as const;
const FAIL_LINES = [
   'Your grip slips and you slide back down.',
   'A branch snaps under you — back to the start.',
   'You mistime the jump and land in the mud.',
] as const;

export default {
   type: 'obstacle',
   render(session) {
      const state = obstacleStateFrom(session.state);

      switch (obstacleOutcome(state)) {
         case 'cleared':
         case 'forced-back':
            // Crash-recovery window: the final step was persisted but the tail
            // (move/cleanup) may not have run. Offer to finish it.
            return finalizeView(session, state);
         case 'ongoing':
            return stepView(session, state);
      }
   },
   async onAction(client, interaction, session, actor, action) {
      if (!interaction.isButton())
         return;

      if (action === 'attempt') return handleAttempt(client, interaction, session, actor);
      if (action === 'finalize') return finalize(client, interaction, session, actor, obstacleStateFrom(session.state));
      if (action === 'retreat') return handleRetreat(interaction, session, actor);
   },
} satisfies ActivityHandler;

async function handleAttempt(
   client: ToscheClient,
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
): Promise<void> {
   const state = obstacleStateFrom(session.state);
   if (obstacleOutcome(state) !== 'ongoing') {
      await finalize(client, interaction, session, actor, state);
      return;
   }

   const success = chance(OBSTACLE_SUCCESS_PERCENT);
   const next = attemptObstacle(state, success, randomItem(success ? SUCCESS_LINES : FAIL_LINES));

   const advanced = await activitySessionService.advance(session._id, session.step, { ...next });
   if (!advanced) {
      // Stale click (double-click or replay) — repaint whatever is authoritative now.
      await repaintCurrent(interaction, session._id);
      return;
   }

   if (obstacleOutcome(next) === 'ongoing') {
      await interaction.update(stepView(advanced, next));
      return;
   }

   // We won the guard on the terminal step, so completion is ours to run.
   await finalize(client, interaction, advanced, actor, next);
}

/** The idempotent completion tail: move (only if cleared) → chronicle → delete session → repaint. */
async function finalize(
   client: ToscheClient,
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
   state: ObstacleState,
): Promise<void> {
   const cleared = obstacleOutcome(state) === 'cleared';
   const name = displayName(actor);
   const obstacle = encounterName(state.encounterId);

   if (cleared)
      await characterService.setLocation(actor._id, state.toId);

   await activitySessionService.complete(session._id);
   await interaction.update(cleared ? clearedView(state) : forcedBackView(state));
   await postChronicle(client, cleared
      ? `🧭 **${name}** reached **${locationName(state.toId)}**, getting past ${obstacle.toLowerCase()} on the way.`
      : `🧭 **${name}** set out for **${locationName(state.toId)}**, but ${obstacle.toLowerCase()} forced them back to **${locationName(state.fromId)}**.`);
}

/** Clean cancel (D17): any AP refund would go here — travel is free for now (D14 placeholder). */
async function handleRetreat(
   interaction: ButtonInteraction,
   session: ActivitySessionDoc,
   actor: CharacterDoc,
): Promise<void> {
   const state = obstacleStateFrom(session.state);

   await activitySessionService.abandon(session._id);
   await interaction.update({
      content: `You think better of it and turn back toward **${locationName(state.fromId)}**, ${displayName(actor)}.`,
      embeds: [],
      components: [],
   });
}

async function repaintCurrent(interaction: ButtonInteraction, sessionId: string): Promise<void> {
   const fresh = await activitySessionService.get(sessionId);

   if (!fresh || fresh.status !== 'active') {
      await interaction.update({ content: 'This activity has already ended.', embeds: [], components: [] });
      return;
   }

   const state = obstacleStateFrom(fresh.state);
   await interaction.update(obstacleOutcome(state) === 'ongoing' ? stepView(fresh, state) : finalizeView(fresh, state));
}

// --- Views --------------------------------------------------------------------

function stepView(session: ActivitySessionDoc, state: ObstacleState): ActivityView {
   const encounter = ENCOUNTERS[state.encounterId as EncounterId];
   const intro = encounter?.kind === 'activity' ? encounter.intro : 'Something blocks the way.';

   const embed = new EmbedBuilder()
      .setColor(OBSTACLE_COLOR)
      .setTitle(`🪵 ${encounterName(state.encounterId)} — on the road to ${locationName(state.toId)}`)
      .setDescription([
         intro,
         state.lastLine ? `\n_${state.lastLine}_` : '',
         `\nProgress: **${state.progress}/${OBSTACLE_PROGRESS_TO_CLEAR}** · Setbacks: **${state.setbacks}/${OBSTACLE_SETBACKS_TO_FAIL}**`,
         '⏳ Walk away for too long and you will give up the crossing.',
      ].filter(Boolean).join('\n'));

   return { embeds: [embed], components: [buttonRow(session._id, 'step')] };
}

function finalizeView(session: ActivitySessionDoc, state: ObstacleState): ActivityView {
   const cleared = obstacleOutcome(state) === 'cleared';
   const embed = new EmbedBuilder()
      .setColor(OBSTACLE_COLOR)
      .setTitle(`🪵 ${encounterName(state.encounterId)}`)
      .setDescription(cleared
         ? `You are over the worst of it — **${locationName(state.toId)}** lies ahead.`
         : `It bested you this time. The road back to **${locationName(state.fromId)}** awaits.`);

   return { embeds: [embed], components: [buttonRow(session._id, 'finalize')] };
}

function clearedView(state: ObstacleState): ActivityView & { content: string } {
   return {
      content: `✅ You get past ${encounterName(state.encounterId).toLowerCase()} and arrive at **${locationName(state.toId)}**.`,
      embeds: [],
      components: [],
   };
}

function forcedBackView(state: ObstacleState): ActivityView & { content: string } {
   return {
      content: `❌ ${encounterName(state.encounterId)} proves too much — you trudge back to **${locationName(state.fromId)}**.`,
      embeds: [],
      components: [],
   };
}

function buttonRow(sessionId: string, mode: 'step' | 'finalize'): ActionRowBuilder<MessageActionRowComponentBuilder> {
   if (mode === 'finalize')
      return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
         new ButtonBuilder().setCustomId(`activity:finalize:${sessionId}`).setLabel('Press on').setEmoji('🥾').setStyle(ButtonStyle.Primary),
      );

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`activity:attempt:${sessionId}`).setLabel('Attempt the crossing').setEmoji('🧗').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`activity:retreat:${sessionId}`).setLabel('Turn back').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
   );
}

/** Encounter display name with a graceful unknown-id fallback (D10 rule 3). */
function encounterName(encounterId: string): string {
   return ENCOUNTERS[encounterId as EncounterId]?.name ?? 'An obstacle';
}
