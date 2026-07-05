// Discord adapter (marked): the read-only skill-tree viewer behind
// `/character skills` (D34's skill panel). Two views:
//   overview → every tree root with the character's trained points + governing
//     attributes, and a select to open one;
//   tree view → one tree's whole node list (a monospace table: points, the
//     Effective a check would roll, and progress toward the next point), a Back
//     button + the same tree select to jump around.
// Personal + ephemeral like `/profile`: the clicker is always the character's
// owner, so no ids ride in the customIds — the handler re-resolves the caller's
// active character each time (stateless, restart-proof). Underscore prefix →
// loader skips it.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import {
   SKILL_ROOT_IDS,
   SKILL_NODE_CAP,
   resolveBlend,
   skillNode,
   subtreeIds,
   nodeDepth,
   isSkillNodeId,
   type AttributeWeights,
   type SkillNodeId,
} from '../../game/data/skills.js';
import { ATTRIBUTES } from '../../game/data/attributes.js';
import { effectiveSkill, nodePoints, usesForNextPoint, type SkillProgression } from '../../game/character/skills.js';
import { displayName } from '../../game/character/identity.js';
import type { CharacterDoc } from '../../db/models/character.js';

const PANEL_COLOR = 0x4E6E58; // quartermaster ledger green (matches /profile)

export interface SkillPanel {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** The overview: every tree root, its trained points, and a picker to open one. */
export function buildSkillOverview(character: CharacterDoc): SkillPanel {
   const skills = character.progression?.skills ?? {};

   const lines = SKILL_ROOT_IDS.map((rootId) => {
      const trained = treeTrainedPoints(skills, rootId);
      const blend = formatBlend(resolveBlend(rootId));
      const mark = trained > 0 ? '📗' : '📖';
      return `${mark} **${skillNode(rootId).name}** — ${trained} pt trained · _${blend}_`;
   });

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`📚 ${displayName(character)} — Skills`)
      .setDescription(`${lines.join('\n')}\n\nOpen a tree below to inspect its branches.`)
      .setFooter({ text: 'Skills rise through use — nothing to spend here yet.' });

   return { embeds: [embed], components: [treePickerRow()] };
}

/** One tree's full breakdown (falls back to the overview on an unknown root id). */
export function buildSkillTreeView(character: CharacterDoc, rootId: string): SkillPanel {
   if (!isSkillNodeId(rootId) || skillNode(rootId).parent !== null)
      return buildSkillOverview(character);

   const skills = character.progression?.skills ?? {};
   const table = subtreeIds(rootId)
      .map((id) => nodeLine(character, skills, id))
      .join('\n');

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`🌳 ${skillNode(rootId).name}`)
      .setDescription([
         `Governing: _${formatBlend(resolveBlend(rootId))}_ · **${treeTrainedPoints(skills, rootId)}** pt trained`,
         '```',
         table,
         '```',
      ].join('\n'))
      .setFooter({ text: 'Eff = what a check on that skill would roll · (banked/needed→) is progress to the next point.' });

   const back = new ButtonBuilder()
      .setCustomId('charskills:overview')
      .setLabel('Back to trees')
      .setEmoji('↩️')
      .setStyle(ButtonStyle.Secondary);

   return {
      embeds: [embed],
      components: [
         treePickerRow(rootId),
         new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(back),
      ],
   };
}

/** One monospace row: indented name · points · rolled Effective · progress. */
function nodeLine(character: CharacterDoc, skills: SkillProgression, id: SkillNodeId): string {
   const points = nodePoints(skills, id);
   const cap = skillNode(id).cap ?? SKILL_NODE_CAP;
   const effective = effectiveSkill(character.attributes, skills, { node: id });

   const label = '  '.repeat(nodeDepth(id)) + skillNode(id).name;
   const pts = `${points}`.padStart(3);
   const eff = `${Math.round(effective)}`.padStart(3);

   // Progress toward the next point (banked uses / uses needed). Hidden once the
   // node is capped — ordinary practice can't push it further.
   let progress = '';
   if (points < cap) {
      const need = usesForNextPoint(id, points);
      const banked = skills[id]?.progress ?? 0;
      if (Number.isFinite(need))
         progress = `  (${banked}/${need}→)`;
   }

   return `${label.padEnd(24)} ${pts} pt   Eff ${eff}${progress}`;
}

/** Σ points over every node in a tree (root + all descendants). */
function treeTrainedPoints(skills: SkillProgression, rootId: SkillNodeId): number {
   return subtreeIds(rootId).reduce((sum, id) => sum + nodePoints(skills, id), 0);
}

/** A weighted blend as `0.2·INT + 0.1·DEX` (empty blends read as "untrained feat"). */
function formatBlend(blend: AttributeWeights): string {
   const parts = Object.entries(blend)
      .filter(([, weight]) => weight)
      .map(([attr, weight]) => `${weight}·${ATTRIBUTES[attr as keyof typeof ATTRIBUTES].abbreviation}`);
   return parts.length > 0 ? parts.join(' + ') : 'no governing attribute';
}

function treePickerRow(selected?: SkillNodeId): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const menu = new StringSelectMenuBuilder()
      .setCustomId('charskills:open')
      .setPlaceholder('Open a skill tree…')
      .addOptions(
         SKILL_ROOT_IDS.map((rootId) => ({
            label: skillNode(rootId).name,
            value: rootId,
            description: skillNode(rootId).description?.slice(0, 100),
            default: rootId === selected,
         })),
      );

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}
