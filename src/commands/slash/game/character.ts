import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { accountService, type SwitchResult } from '../../../db/services/accountService.js';
import { characterService } from '../../../db/services/characterService.js';
import { canEdit, MAX_CHARACTERS_PER_ACCOUNT } from '../../../game/character/rules.js';
import { displayName, STATUS_LABEL } from '../../../game/character/identity.js';
import { RACES } from '../../../game/data/races.js';
import { buildIdentityModal } from '../../components/_characterModals.js';
import { buildCharacterPanel } from '../../components/_characterPanel.js';
import { buildSkillOverview } from '../../components/_skillPanel.js';
import { buildCharacterSheet } from './_characterSheet.js';
import type { ToscheClient } from '../../../client.js';

const SWITCH_FAILURE: Record<Exclude<SwitchResult, { ok: true }>['reason'], string> = {
   'not-owned': "That isn't one of your characters.",
   'current-busy': 'Your current character is mid-activity — finish it before switching.',
   'target-busy': "That character is mid-activity — you can't switch to it right now.",
};

const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export default {
   data: new SlashCommandBuilder()
      .setName('character')
      .setDescription('Create and manage your characters.')
      .addSubcommand((sub) => sub.setName('create').setDescription('Create a character, or continue editing your active draft (race, details, submit).'))
      .addSubcommand((sub) =>
         sub
            .setName('view')
            .setDescription("Show a player's active character sheet.")
            .addUserOption((option) =>
               option.setName('user').setDescription('Whose character to show (defaults to you).'),
            ),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List the characters you command.'))
      .addSubcommand((sub) => sub.setName('skills').setDescription("Inspect your active character's skill trees."))
      .addSubcommand((sub) =>
         sub
            .setName('switch')
            .setDescription('Switch which character you control.')
            .addStringOption((option) =>
               option.setName('character').setDescription('Which character.').setRequired(true).setAutocomplete(true),
            ),
      ),
   category: 'game',
   async execute(client, interaction) {
      switch (interaction.options.getSubcommand()) {
         case 'create': return createOrEditCharacter(interaction);
         case 'view': return viewCharacter(interaction);
         case 'list': return listCharacters(interaction);
         case 'skills': return viewSkills(interaction);
         case 'switch': return switchCharacter(client, interaction);
      }
   },
   async autocomplete(_client, interaction) {
      if (interaction.options.getSubcommand() !== 'switch')
         return;

      const focused = interaction.options.getFocused().toLowerCase();
      const characters = await characterService.getOwned(interaction.user.id);

      const choices = characters
         .filter((character) => displayName(character).toLowerCase().includes(focused))
         .slice(0, 25)
         .map((character) => ({
            name: truncate(`${displayName(character)} (${character.approvalStatus})`, 100),
            value: character._id,
         }));

      await interaction.respond(choices);
   },
} satisfies SlashCommand;

/** The single creation/editing entry point: continues your active draft's
 *  panel (race, details, attributes, submit all live there) if it's still
 *  editable, otherwise starts a new one (respecting the character cap). */
async function createOrEditCharacter(interaction: ChatInputCommandInteraction): Promise<void> {
   const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);

   if (character && canEdit(character)) {
      await interaction.reply({ ...buildCharacterPanel(character), ...ephemeral });
      return;
   }

   const count = await characterService.countOwned(interaction.user.id);
   if (count >= MAX_CHARACTERS_PER_ACCOUNT) {
      await interaction.reply({ content: `You already command ${MAX_CHARACTERS_PER_ACCOUNT} characters — the maximum.`, ...ephemeral });
      return;
   }

   // Name is required up front (the schema needs it); the rest of creation —
   // race, submit — happens on the panel the modal-submit lands you on.
   await interaction.showModal(buildIdentityModal({ customId: 'character:create', title: 'Create a character' }));
}

/** The public character sheet (pre-D27 `/profile`). Viewing yourself onboards
 *  you; viewing someone else is a pure read (no documents created for them). */
async function viewCharacter(interaction: ChatInputCommandInteraction): Promise<void> {
   const target = interaction.options.getUser('user') ?? interaction.user;

   if (target.bot) {
      await interaction.reply('Machines do not enlist. They serve, yes-yes.');
      return;
   }

   const character = target.id === interaction.user.id
      ? await accountService.getActiveCharacter(target.id, target.displayName)
      : await accountService.peekActiveCharacter(target.id);

   if (!character) {
      await interaction.reply(`${target.displayName} has no active character.`);
      return;
   }

   // The frame is shown in the VIEWER's unit preference (R19), not the target's.
   const { units } = await accountService.getSettings(interaction.user.id);
   await interaction.reply({ embeds: [buildCharacterSheet(character, units)] });
}

async function listCharacters(interaction: ChatInputCommandInteraction): Promise<void> {
   const account = await accountService.getOrCreate(interaction.user.id, interaction.user.displayName);
   const characters = await characterService.getOwned(interaction.user.id);

   if (characters.length === 0) {
      await interaction.reply({ content: 'You command no characters yet. Draft one with `/character create`.', ...ephemeral });
      return;
   }

   const lines = characters.map((character) => {
      const active = character._id === account.activeCharacterId ? '▶️ ' : '• ';
      const race = character.identity.race ? RACES[character.identity.race].name : 'raceless';
      return `${active}**${displayName(character)}** — ${STATUS_LABEL[character.approvalStatus]} · ${race}`;
   });

   const embed = new EmbedBuilder()
      .setTitle(`Your characters (${characters.length}/${MAX_CHARACTERS_PER_ACCOUNT})`)
      .setDescription(lines.join('\n'));

   await interaction.reply({ embeds: [embed], ...ephemeral });
}

/** The deep-layer skill-tree viewer for your active character (D34). Ephemeral +
 *  personal; navigation lives in the `charskills` component handler. */
async function viewSkills(interaction: ChatInputCommandInteraction): Promise<void> {
   const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);

   if (!character) {
      await interaction.reply({ content: 'You have no active character. Draft one with `/character create`.', ...ephemeral });
      return;
   }

   await interaction.reply({ ...buildSkillOverview(character), ...ephemeral });
}

async function switchCharacter(client: ToscheClient, interaction: ChatInputCommandInteraction): Promise<void> {
   const characterId = interaction.options.getString('character', true);
   const result = await accountService.setActiveCharacter(interaction.user.id, interaction.user.displayName, characterId, client.locks);

   if (!result.ok) {
      await interaction.reply({ content: SWITCH_FAILURE[result.reason], ...ephemeral });
      return;
   }

   const character = await characterService.get(characterId);
   await interaction.reply({ content: `🎭 You are now controlling **${character ? displayName(character) : 'your character'}**.`, ...ephemeral });
}

function truncate(text: string, max: number): string {
   return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
