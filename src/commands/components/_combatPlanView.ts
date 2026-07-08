import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   StringSelectMenuOptionBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import { displayName } from '../../game/character/identity.js';
import { skillSum } from '../../game/character/skills.js';
import { fightingStyle, stylesForFamily, type FightingStyleId, type StyleFamily } from '../../game/combat/styles.js';
import { describeTrigger, sanitizeFamilyPlan, MAX_PLAN_RULES, type FamilyPlan, type PlanTriggerKind } from '../../game/combat/plan.js';
import type { CharacterDoc } from '../../db/models/character.js';

// Colocated Discord builders for the `/character combat` panel (D41) — the
// combat-plan editor: default fighting style per family + conditional switch
// rules ("below 50% Health go Stonewall"). Stateless and personal like the
// `/profile` panel (ephemeral, clicker = owner, no character ids in customIds —
// every action re-resolves the active character); the two-step rule builder
// carries its half-built rule in the customId, the panel pattern everywhere.

const PANEL_COLOR = 0x8B2B2B; // matches the duel views — this feeds the same fights

/** The families a player can plan for (D42: armed splits by grip). Ranged joins
 *  when ranged combat exists. Three families = 3 select rows + 2 button rows —
 *  exactly Discord's 5-row cap; a fourth family needs a paged panel. */
export const PLAN_FAMILIES = ['unarmed', 'one_handed', 'two_handed'] as const;

export type PlanFamily = (typeof PLAN_FAMILIES)[number];

export function isPlanFamily(family: string): family is PlanFamily {
   return (PLAN_FAMILIES as readonly string[]).includes(family);
}

const FAMILY_LABEL: Record<PlanFamily, string> = {
   unarmed: '🥊 Unarmed',
   one_handed: '🗡️ One-Handed',
   two_handed: '⚔️ Two-Handed',
};

// The discrete trigger menu (v1): fixed, legible steps beat free-text values —
// value format `<kind>.<number>`, parsed by parseTriggerValue below.
const TRIGGER_OPTIONS: { kind: PlanTriggerKind; values: number[]; label: (value: number) => string }[] = [
   { kind: 'self-health-below', values: [25, 50, 75], label: (value) => `My Health drops below ${value}%` },
   { kind: 'foe-health-below', values: [25, 50, 75], label: (value) => `Foe's Health drops below ${value}%` },
   { kind: 'round-at-least', values: [3, 5, 10], label: (value) => `From round ${value} on` },
];

export interface PanelView {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** The sanitized stored plan for one family (D10 rule 3 — a renamed style never
 *  renders, let alone fights). Shared by the view and the handler. */
export function familyPlanOf(character: CharacterDoc, family: PlanFamily): FamilyPlan {
   return sanitizeFamilyPlan(character.combatPlan?.[family], family);
}

/** The main panel: current plan per family + the controls to change it. */
export function buildCombatPlanPanel(character: CharacterDoc): PanelView {
   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`⚔️ ${displayName(character)} — combat plan`)
      .setDescription(
         'Standing orders for every real fight (duels, the Spire ladder). Pick a default ' +
         `**fighting style** per family and up to ${MAX_PLAN_RULES} **switch rules** — ` +
         'the first rule that fires wins. Fighting in a style trains its branch; ' +
         'the better you know it, the better you strike *and* defend in it.',
      )
      .addFields(PLAN_FAMILIES.map((family) => ({
         name: FAMILY_LABEL[family],
         value: planLines(character, familyPlanOf(character, family)),
         inline: false,
      })))
      .setFooter({ text: 'Styles are family-specific — fists, sidearms and great weapons are different schools.' });

   const styleRows = PLAN_FAMILIES.map((family) => styleSelectRow(character, family));

   // One row of add-rule buttons + one of clear buttons (a combined per-family
   // pair would overflow Discord's 5 components per row at three families).
   const addRuleRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      ...PLAN_FAMILIES.map((family) =>
         new ButtonBuilder()
            .setCustomId(`combatplan:newrule:${family}`)
            .setLabel(`Rule (${FAMILY_LABEL[family].split(' ')[1]})`)
            .setEmoji('➕')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(familyPlanOf(character, family).rules.length >= MAX_PLAN_RULES),
      ),
   );
   const clearRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      ...PLAN_FAMILIES.map((family) =>
         new ButtonBuilder()
            .setCustomId(`combatplan:clearrules:${family}`)
            .setLabel(`Clear (${FAMILY_LABEL[family].split(' ')[1]})`)
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(familyPlanOf(character, family).rules.length === 0),
      ),
   );

   return { embeds: [embed], components: [...styleRows, addRuleRow, clearRow] };
}

/** Step 1 of the rule builder: pick the trigger. */
export function buildTriggerPicker(character: CharacterDoc, family: PlanFamily): PanelView {
   const embed = ruleBuilderEmbed(character, family, 'When should the switch happen?');

   const select = new StringSelectMenuBuilder()
      .setCustomId(`combatplan:ruletrigger:${family}`)
      .setPlaceholder('Pick the trigger…')
      .addOptions(TRIGGER_OPTIONS.flatMap((option) =>
         option.values.map((value) =>
            new StringSelectMenuOptionBuilder()
               .setValue(`${option.kind}.${value}`)
               .setLabel(option.label(value)),
         ),
      ));

   return { embeds: [embed], components: [selectRow(select), cancelRow()] };
}

/** Step 2 of the rule builder: pick the style to switch to (the half-built
 *  trigger rides the customId — stateless, restart-proof). */
export function buildRuleStylePicker(character: CharacterDoc, family: PlanFamily, triggerValue: string): PanelView {
   const trigger = parseTriggerValue(triggerValue);
   const embed = ruleBuilderEmbed(
      character,
      family,
      trigger ? `**${describeTrigger(trigger)}** → switch to which style?` : 'Switch to which style?',
   );

   const select = new StringSelectMenuBuilder()
      .setCustomId(`combatplan:rulestyle:${family}:${triggerValue}`)
      .setPlaceholder('Pick the style…')
      .addOptions(styleOptions(character, family, null, false));

   return { embeds: [embed], components: [selectRow(select), cancelRow()] };
}

/** Parses a `<kind>.<value>` trigger token from a select value / customId back
 *  into a trigger; null on junk (a stale or hand-crafted id must not crash). */
export function parseTriggerValue(token: string): { kind: PlanTriggerKind; value: number } | null {
   const [kind, raw] = token.split('.');
   const value = Number(raw);

   if (!TRIGGER_OPTIONS.some((option) => option.kind === kind) || !Number.isFinite(value))
      return null;

   return { kind: kind as PlanTriggerKind, value };
}

// --- Internals ----------------------------------------------------------------

function planLines(character: CharacterDoc, plan: FamilyPlan): string {
   const defaultLine = plan.style
      ? `Default: ${styleLine(character, plan.style)}`
      : 'Default: fights plain — no style.';

   const ruleLines = plan.rules.map((rule, index) => {
      const style = fightingStyle(rule.style);
      return `${index + 1}. When ${describeTrigger(rule.trigger)} → ${style.emoji} **${style.name}**`;
   });

   return [defaultLine, ...ruleLines].join('\n');
}

function styleLine(character: CharacterDoc, styleId: FightingStyleId): string {
   const style = fightingStyle(styleId);
   return `${style.emoji} **${style.name}** (trained ${trainedPoints(character, styleId)})`;
}

/** Σ points along the style's node path — the number the style actually rolls
 *  with (the "how well do I know this" a player wants next to each option). */
function trainedPoints(character: CharacterDoc, styleId: FightingStyleId): number {
   return skillSum(character.progression?.skills ?? {}, [fightingStyle(styleId).node]);
}

function styleSelectRow(character: CharacterDoc, family: PlanFamily): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const plan = familyPlanOf(character, family);

   const select = new StringSelectMenuBuilder()
      .setCustomId(`combatplan:style:${family}`)
      .setPlaceholder(`${FAMILY_LABEL[family]} — default style…`)
      .addOptions(styleOptions(character, family, plan.style, true));

   return selectRow(select);
}

function styleOptions(character: CharacterDoc, family: StyleFamily, current: FightingStyleId | null, withNone: boolean): StringSelectMenuOptionBuilder[] {
   const options = stylesForFamily(family).map(({ id, style }) =>
      new StringSelectMenuOptionBuilder()
         .setValue(id)
         .setLabel(style.name)
         .setEmoji(style.emoji)
         .setDescription(truncate(`${style.description} · trained ${trainedPoints(character, id)}`, 100))
         .setDefault(current === id),
   );

   if (withNone)
      options.unshift(
         new StringSelectMenuOptionBuilder()
            .setValue('none')
            .setLabel('No style')
            .setEmoji('⚖️')
            .setDescription('Fight plain — no modifiers, no effects.')
            .setDefault(current === null),
      );

   return options;
}

function ruleBuilderEmbed(character: CharacterDoc, family: PlanFamily, prompt: string): EmbedBuilder {
   return new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`➕ New ${FAMILY_LABEL[family]} switch rule`)
      .setDescription(`${prompt}\n\n${planLines(character, familyPlanOf(character, family))}`);
}

function selectRow(select: StringSelectMenuBuilder): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select);
}

function cancelRow(): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId('combatplan:show').setLabel('Back').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
   );
}

function truncate(text: string, max: number): string {
   return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
