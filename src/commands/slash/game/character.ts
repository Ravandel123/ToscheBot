import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { settings } from '../../../settings.js';
import { accountService, type SwitchResult } from '../../../db/services/accountService.js';
import { characterService } from '../../../db/services/characterService.js';
import { canEdit, canSubmit, MAX_CHARACTERS_PER_ACCOUNT } from '../../../game/character/rules.js';
import { displayName, STATUS_LABEL } from '../../../game/character/identity.js';
import { RACES, type RaceId } from '../../../game/data/races.js';
import { resolveGuildChannel } from '../../../lib/discord.js';
import { buildIdentityModal } from '../../components/_characterModals.js';
import { buildCharacterPanel } from '../../components/_characterPanel.js';
import { buildDecreeButtons, buildDecreeEmbed } from '../../components/_characterDecree.js';
import type { ApprovalStatus, CharacterDoc } from '../../../db/models/character.js';
import type { ToscheClient } from '../../../client.js';

const RACE_CHOICES = Object.entries(RACES).map(([id, def]) => ({ name: def.name, value: id }));

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
      .addSubcommand((sub) => sub.setName('create').setDescription('Create a character — opens the creation panel.'))
      .addSubcommand((sub) => sub.setName('edit').setDescription('Open the panel to edit your active character (race, details, submit).'))
      .addSubcommand((sub) =>
         sub
            .setName('race')
            .setDescription("Set your active character's race.")
            .addStringOption((option) =>
               option.setName('race').setDescription('Which race.').setRequired(true).addChoices(...RACE_CHOICES),
            ),
      )
      .addSubcommand((sub) => sub.setName('submit').setDescription('Submit your active character to the Imperator for approval.'))
      .addSubcommand((sub) => sub.setName('list').setDescription('List the characters you command.'))
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
         case 'create': return createCharacter(interaction);
         case 'edit': return editCharacter(interaction);
         case 'race': return setRace(interaction);
         case 'submit': return submitCharacter(interaction);
         case 'list': return listCharacters(interaction);
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

async function createCharacter(interaction: ChatInputCommandInteraction): Promise<void> {
   const count = await characterService.countOwned(interaction.user.id);

   if (count >= MAX_CHARACTERS_PER_ACCOUNT) {
      await interaction.reply({ content: `You already command ${MAX_CHARACTERS_PER_ACCOUNT} characters — the maximum.`, ...ephemeral });
      return;
   }

   // Name is required up front (the schema needs it); the rest of creation —
   // race, submit — happens on the panel the modal-submit lands you on.
   await interaction.showModal(buildIdentityModal({ customId: 'character:create', title: 'Create a character' }));
}

async function editCharacter(interaction: ChatInputCommandInteraction): Promise<void> {
   const character = await activeCharacter(interaction);
   if (!character)
      return;

   if (!canEdit(character)) {
      await interaction.reply({ content: notEditableMessage(character.approvalStatus), ...ephemeral });
      return;
   }

   // Open the interactive panel (race dropdown + Edit details + Submit).
   await interaction.reply({ ...buildCharacterPanel(character), ...ephemeral });
}

async function setRace(interaction: ChatInputCommandInteraction): Promise<void> {
   const race = interaction.options.getString('race', true) as RaceId;
   const character = await activeCharacter(interaction);
   if (!character)
      return;

   if (!canEdit(character)) {
      await interaction.reply({ content: notEditableMessage(character.approvalStatus), ...ephemeral });
      return;
   }

   await characterService.setRace(character._id, race);
   await interaction.reply({ content: `🧬 **${character.identity.name}** is now ${RACES[race].name}.`, ...ephemeral });
}

async function submitCharacter(interaction: ChatInputCommandInteraction): Promise<void> {
   if (!interaction.guild) {
      await interaction.reply({ content: 'Petitions are filed on the server, not in DMs.', ...ephemeral });
      return;
   }

   const character = await activeCharacter(interaction);
   if (!character)
      return;

   const check = canSubmit(character);
   if (!check.ok) {
      const reason = check.reason === 'incomplete'
         ? 'Give it at least a name (2+ characters) and a race (`/character race`) before submitting.'
         : notEditableMessage(character.approvalStatus);
      await interaction.reply({ content: reason, ...ephemeral });
      return;
   }

   const channel = resolveGuildChannel(interaction.guild, settings.channels.imperialDecrees);
   if (!channel?.isSendable()) {
      await interaction.reply({
         content: 'The Hall of Decrees is missing. Ask the Imperator to set `channels.imperialDecrees` in settings.',
         ...ephemeral,
      });
      return;
   }

   await channel.send({ embeds: [buildDecreeEmbed(character)], components: [buildDecreeButtons(character._id)] });

   // Guarded transition: a concurrent submit (panel + slash) races here — the
   // loser posted a duplicate decree, whose buttons will report "no longer
   // pending" once the real one is decided.
   if (!await characterService.submitForApproval(character._id)) {
      await interaction.reply({ content: 'That petition was already filed.', ...ephemeral });
      return;
   }

   await interaction.reply({
      content: `📜 **${character.identity.name}** has been submitted to the Imperator. You'll be told the verdict.`,
      ...ephemeral,
   });
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

/** Fetches the user's active character, replying with a friendly note (and returning null) if there is none. */
async function activeCharacter(interaction: ChatInputCommandInteraction): Promise<CharacterDoc | null> {
   const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);

   if (!character)
      await interaction.reply({ content: 'You have no active character. Draft one with `/character create`.', ...ephemeral });

   return character;
}

function notEditableMessage(status: ApprovalStatus): string {
   if (status === 'pending')
      return "That character is awaiting the Imperator's verdict — you can't change it now.";
   if (status === 'approved')
      return 'That character is already recognized; approved characters are sealed.';
   return "That character can't be edited right now.";
}

function truncate(text: string, max: number): string {
   return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
