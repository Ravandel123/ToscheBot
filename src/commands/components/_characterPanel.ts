// Discord adapter (marked): the interactive character-creation wizard panel.
// One ephemeral message rendered FROM the creation-step catalog (D20):
//   overview → checklist of steps + a step picker + Continue/Submit buttons;
//   step view → ONE select-kind step's control + Back (modal steps open a modal
//   directly, so they need no view of their own).
// Stateless: the character id (and step id) ride in every customId and the
// state is the DB draft itself, so the wizard survives restarts and can be
// resumed any time with `/character edit`. Underscore prefix → loader skips it.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import { RACES } from '../../game/data/races.js';
import { canEdit } from '../../game/character/rules.js';
import { CREATION_STEPS, firstIncompleteStep, requiredStepsComplete, type CreationStep } from '../../game/character/creationSteps.js';
import { GENDER_CHOICES, STATUS_LABEL, isHttpUrl } from '../../game/character/identity.js';
import type { CharacterDoc } from '../../db/models/character.js';

const PANEL_COLOR = 0xB8860B; // dark goldenrod — matches the decree

export interface CharacterPanel {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

// Select-kind steps need a row builder here; modal-kind steps are handled by
// `_characterModals.ts`. Adding a select step = catalog entry + one line here.
const SELECT_STEP_ROWS: Record<string, (character: CharacterDoc) => ActionRowBuilder<MessageActionRowComponentBuilder>> = {
   race: raceRow,
   gender: genderRow,
};

/** Builds the wizard overview for a character. Editable (draft/rejected) → full controls; otherwise a read-only state card. */
export function buildCharacterPanel(character: CharacterDoc): CharacterPanel {
   const embed = identityEmbed(character);

   if (!canEdit(character)) {
      const note = character.approvalStatus === 'rejected' && character.rejectionReason
         ? `${STATUS_LABEL.rejected} — ${character.rejectionReason}`
         : STATUS_LABEL[character.approvalStatus];
      return { embeds: [embed.setDescription(note)], components: [] };
   }

   const complete = requiredStepsComplete(character);
   const checklist = CREATION_STEPS
      .map((step) => `${stepMark(step, character)} **${step.title}**${step.required ? '' : ' _(optional)_'} — ${step.summary(character)}`)
      .join('\n');
   // A rejected character is editable again — show why, so the player can fix it.
   const rejectedNote = character.approvalStatus === 'rejected' && character.rejectionReason
      ? `❌ **Previously rejected:** ${character.rejectionReason}\n\n`
      : '';
   embed.setDescription(
      rejectedNote + checklist + (complete
         ? '\n\n✅ Ready — press **Submit for approval**.'
         : '\n\nPick a step below (or press **Continue**) to fill it in.'),
   );

   return { embeds: [embed], components: [stepPickerRow(character), overviewButtonRow(character, complete)] };
}

/** Builds the focused view of one select-kind step (its dropdown + Back). */
export function buildCharacterStepView(character: CharacterDoc, step: CreationStep): CharacterPanel {
   const embed = identityEmbed(character)
      .setDescription(`${stepMark(step, character)} Step: **${step.title}** — pick below, then go back to the overview.`);

   const stepRow = SELECT_STEP_ROWS[step.id];
   const components = [
      ...(stepRow ? [stepRow(character)] : []),
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
         new ButtonBuilder().setCustomId(`character:panel-overview:${character._id}`).setLabel('Back to overview').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
      ),
   ];

   return { embeds: [embed], components };
}

function identityEmbed(character: CharacterDoc): EmbedBuilder {
   const { identity } = character;
   const raceName = identity.race ? RACES[identity.race].name : '—';
   const genderLabel = GENDER_CHOICES.find((g) => g.value === identity.gender)?.label ?? identity.gender ?? '—';

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`🪶 ${identity.name || 'New character'}`)
      .addFields(
         { name: 'Name', value: identity.name || '—', inline: true },
         { name: 'Epithet', value: identity.epithet || '—', inline: true },
         { name: 'Race', value: raceName, inline: true },
         { name: 'Gender', value: genderLabel || '—', inline: true },
         { name: 'Description', value: identity.bio || '—' },
      );

   if (isHttpUrl(identity.avatarUrl))
      embed.setThumbnail(identity.avatarUrl);

   return embed;
}

function stepMark(step: CreationStep, character: CharacterDoc): string {
   return step.isComplete(character) ? '✅' : '⬜';
}

function stepPickerRow(character: CharacterDoc): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`character:panel-step:${character._id}`)
      .setPlaceholder('Choose a step to fill in / change…')
      .addOptions(
         CREATION_STEPS.map((step) => ({
            label: `${step.title}${step.required ? '' : ' (optional)'}`,
            value: step.id,
            description: step.summary(character).slice(0, 100),
            emoji: step.isComplete(character) ? '✅' : '⬜',
         })),
      );

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function overviewButtonRow(character: CharacterDoc, complete: boolean): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const next = firstIncompleteStep(character);

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`character:panel-continue:${character._id}`).setLabel(next ? `Continue: ${next.title}` : 'All steps done').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(!next),
      new ButtonBuilder().setCustomId(`character:panel-submit:${character._id}`).setLabel('Submit for approval').setEmoji('📜').setStyle(ButtonStyle.Success).setDisabled(!complete),
   );
}

function raceRow(character: CharacterDoc): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`character:panel-race:${character._id}`)
      .setPlaceholder(character.identity.race ? `Race: ${RACES[character.identity.race].name}` : 'Choose a race')
      .addOptions(
         Object.entries(RACES).map(([id, def]) => ({
            label: def.name,
            value: id,
            description: def.description.slice(0, 100),
            default: id === character.identity.race,
         })),
      );

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function genderRow(character: CharacterDoc): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const current = GENDER_CHOICES.find((g) => g.value === character.identity.gender);
   const menu = new StringSelectMenuBuilder()
      .setCustomId(`character:panel-gender:${character._id}`)
      .setPlaceholder(current ? `Gender: ${current.label}` : 'Choose a gender')
      .addOptions(GENDER_CHOICES.map((g) => ({ label: g.label, value: g.value, default: g.value === character.identity.gender })));

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}
