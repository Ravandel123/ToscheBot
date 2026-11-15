// What the interactive activity handlers (challenge, dialogue) share: the
// option buttons with the activity's exit, taking that exit, the stale-click
// repaint, the roll summary, the training line, and the hub banner a finished
// activity lands on. This folder is loader-invisible.
import { ButtonBuilder, ButtonStyle, type ButtonInteraction } from 'discord.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { characterService } from '../../../db/services/characterService.js';
import { checkTrainingWeight, type CheckDefinition, type CheckResult } from '../../../game/checks.js';
import { buttonRows, type ComponentRow } from '../../../lib/discord.js';
import { levelUpList } from '../_format.js';
import { freshHubView } from '../_hubView.js';
import type { ActivityExit } from '../../../game/activity/exit.js';
import type { ActivityView } from '../../../types/activities.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';

interface OptionButton {
   id: string;
   label: string;
   emoji: string;
}

/** One button per option, then the exit button, in rows of five. `exitAction`
 *  is the customId action the handler routes its exit on. */
export function optionRows(sessionId: string, options: readonly OptionButton[], exitAction: string, exit: ActivityExit): ComponentRow[] {
   return buttonRows([
      ...options.map((option) =>
         new ButtonBuilder().setCustomId(`activity:opt:${sessionId}:${option.id}`).setLabel(option.label).setEmoji(option.emoji).setStyle(ButtonStyle.Primary),
      ),
      new ButtonBuilder().setCustomId(`activity:${exitAction}:${sessionId}`).setLabel(exit.label).setEmoji(exit.emoji).setStyle(ButtonStyle.Secondary),
   ]);
}

/** Ends the session by its exit. Only the call that removed the session
 *  applies the exit's consequences, so a double-click cannot charge them twice. */
export async function takeExit(session: ActivitySessionDoc, characterId: string, exit: ActivityExit): Promise<void> {
   if (await activitySessionService.abandon(session._id) && exit.traits)
      await characterService.applyTraitDeltas(characterId, exit.traits);
}

/** A stale click (double-click, replay, a retired option): repaint whatever is
 *  authoritative now, or say the activity is over. */
export async function repaintSession(
   interaction: ButtonInteraction,
   sessionId: string,
   render: (session: ActivitySessionDoc) => ActivityView,
   endedLine: string,
): Promise<void> {
   const fresh = await activitySessionService.get(sessionId);
   await interaction.update(fresh?.status === 'active' ? render(fresh) : { content: endedLine, embeds: [], components: [] });
}

/** " (🎲 37 vs **52%** — success)" after an outcome line. */
export function rollSummary(check: CheckResult): string {
   return `(🎲 ${check.roll} vs **${check.target}%** — ${check.success ? 'success' : 'failure'})`;
}

/** Learn-by-doing: a rolled check on a skill node trains its path, success or
 *  failure alike. Returns the "you improved" line, or '' when nothing ranked up. */
export async function trainFromCheck(characterId: string, spec: CheckDefinition | undefined, check: CheckResult | null, lead: string): Promise<string> {
   if (!check || !spec?.node)
      return '';

   const levelUps = await characterService.creditSkillUse(characterId, [spec.node], checkTrainingWeight(check.target));
   return levelUps.length > 0 ? `📈 ${lead} — ${levelUpList(levelUps)}.` : '';
}

/** The hub where the character now stands, with `banner` on top — where a
 *  finished or abandoned activity lands. */
export async function hubAfter(characterId: string, banner: string): Promise<ActivityView> {
   const character = await characterService.get(characterId);
   return character ? freshHubView(character, banner) : { content: banner, embeds: [], components: [] };
}
