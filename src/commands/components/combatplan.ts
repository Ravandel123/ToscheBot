import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { characterService } from '../../db/services/characterService.js';
import { isFightingStyleId, FIGHTING_STYLES } from '../../game/combat/styles.js';
import { MAX_PLAN_RULES, sanitizeFamilyPlan } from '../../game/combat/plan.js';
import {
   buildCombatPlanPanel,
   buildFightingStylePanel,
   buildRuleStylePicker,
   buildTriggerPicker,
   familyPlanOf,
   isPlanFamily,
   parseTriggerValue,
   type PlanFamily,
} from './_combatPlanView.js';
import { ephemeral, type PanelView } from '../../lib/discord.js';
import { NO_ACTIVE_CHARACTER } from './_characterAction.js';
import type { CharacterDoc } from '../../db/models/character.js';

// Handles every `combatplan:*` interaction from the `/character combat` panel
//. Ephemeral + personal, so the clicker owns the account — every action
// re-resolves their ACTIVE character (stateless, restart-proof, and a character
// switch mid-panel simply starts editing the new active one):
//   simple                        → the simple "how do you fight?" panel;
//   quick:<family>                → set the default style FROM the simple panel;
//   style:<family>                → set the family's default style ('none' = plain);
//   newrule:<family>              → open the rule builder (step 1: trigger);
//   ruletrigger:<family>          → step 2: pick the style (trigger rides on);
//   rulestyle:<family>:<trigger>  → append the rule and save;
//   clearrules:<family>           → drop the family's rules;
//   show                          → the full tactics panel.
//
// A plan edit is one atomic $set of the family subtree — no lock needed: a
// fight snapshots the plan once under ITS lock (combatProfile), so an edit
// mid-bout affects only the next fight, never a running one.

export default {
   namespace: 'combatplan',
   async handle(_client, interaction) {
      if (!interaction.isButton() && !interaction.isStringSelectMenu())
         return;

      const [, action, family, extra] = interaction.customId.split(':');

      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.update({ content: NO_ACTIVE_CHARACTER, embeds: [], components: [] });
         return;
      }

      if (action === 'show') {
         await interaction.update(buildCombatPlanPanel(character));
         return;
      }
      if (action === 'simple') {
         await interaction.update(buildFightingStylePanel(character));
         return;
      }

      if (!family || !isPlanFamily(family)) {
         await interaction.reply({ content: 'That control belongs to a family I no longer know.', ...ephemeral });
         return;
      }

      if (interaction.isStringSelectMenu()) {
         if (action === 'style') return setDefaultStyle(interaction, character, family);
         if (action === 'quick') return setDefaultStyle(interaction, character, family, buildFightingStylePanel);
         if (action === 'ruletrigger') {
            await interaction.update(buildRuleStylePicker(character, family, interaction.values[0]));
            return;
         }
         if (action === 'rulestyle') return appendRule(interaction, character, family, extra);
         return;
      }

      if (action === 'newrule') return openRuleBuilder(interaction, character, family);
      if (action === 'clearrules') return clearRules(interaction, character, family);
   },
} satisfies ComponentHandler;

async function setDefaultStyle(
   interaction: StringSelectMenuInteraction,
   character: CharacterDoc,
   family: PlanFamily,
   repaint: (character: CharacterDoc) => PanelView = buildCombatPlanPanel,
): Promise<void> {
   const picked = interaction.values[0];
   const style = picked !== 'none' && isFightingStyleId(picked) && FIGHTING_STYLES[picked].family === family
      ? picked
      : null;

   await savePlan(interaction, character, family, { ...familyPlanOf(character, family), style }, repaint);
}

async function openRuleBuilder(interaction: ButtonInteraction, character: CharacterDoc, family: PlanFamily): Promise<void> {
   if (familyPlanOf(character, family).rules.length >= MAX_PLAN_RULES) {
      await interaction.reply({ content: `A plan holds at most ${MAX_PLAN_RULES} rules — clear one first.`, ...ephemeral });
      return;
   }

   await interaction.update(buildTriggerPicker(character, family));
}

async function appendRule(interaction: StringSelectMenuInteraction, character: CharacterDoc, family: PlanFamily, triggerToken: string | undefined): Promise<void> {
   const trigger = triggerToken ? parseTriggerValue(triggerToken) : null;
   const picked = interaction.values[0];

   if (!trigger || !isFightingStyleId(picked) || FIGHTING_STYLES[picked].family !== family) {
      await interaction.reply({ content: 'That rule no longer parses — start it again from the panel.', ...ephemeral });
      return;
   }

   const current = familyPlanOf(character, family);
   if (current.rules.length >= MAX_PLAN_RULES) {
      await interaction.reply({ content: `A plan holds at most ${MAX_PLAN_RULES} rules — clear one first.`, ...ephemeral });
      return;
   }

   await savePlan(interaction, character, family, {
      ...current,
      rules: [...current.rules, { trigger, style: picked }],
   });
}

async function clearRules(interaction: ButtonInteraction, character: CharacterDoc, family: PlanFamily): Promise<void> {
   await savePlan(interaction, character, family, { ...familyPlanOf(character, family), rules: [] });
}

/** Sanitize → persist → repaint. The sanitize pass is belt-and-braces: every
 *  input above is already validated, but the stored shape must stay clean even
 *  if a future control slips. */
async function savePlan(
   interaction: ButtonInteraction | StringSelectMenuInteraction,
   character: CharacterDoc,
   family: PlanFamily,
   plan: unknown,
   repaint: (character: CharacterDoc) => PanelView = buildCombatPlanPanel,
): Promise<void> {
   const clean = sanitizeFamilyPlan(plan, family);
   await characterService.setCombatPlan(character._id, family, clean);

   const fresh = await characterService.get(character._id);
   await interaction.update(repaint(fresh ?? character));
}
