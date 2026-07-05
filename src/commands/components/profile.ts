import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from 'discord.js';
import { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { BOOLEAN_SETTING_KEYS, type BooleanSettingKey, type UnitSystem } from '../../db/models/account.js';
import { isValidTimeZone } from '../../lib/datetime.js';
import { fetchProfilePanel } from './_profilePanel.js';
import { buildSettingModal, type SettingField } from './_profileModals.js';

// Handles every `profile:*` interaction from the account panel (D27/R19). The
// panel is ephemeral, so the clicker is always the account owner:
//   toggle:<key>  → flip a boolean setting;
//   units         → cycle metric ⇄ imperial;
//   country/timezone → open a text modal → set-country/set-timezone save it.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export default {
   namespace: 'profile',
   async handle(_client, interaction) {
      const [, action, key] = interaction.customId.split(':');

      if (interaction.isModalSubmit()) {
         if (action === 'set-country') return saveText(interaction, 'country');
         if (action === 'set-timezone') return saveText(interaction, 'timezone');
         return;
      }

      if (!interaction.isButton())
         return;

      if (action === 'toggle') return toggleBoolean(interaction, key);
      if (action === 'units') return cycleUnits(interaction);
      if (action === 'country') return interaction.showModal(buildSettingModal('country', await currentSetting(interaction.user.id, 'country')));
      if (action === 'timezone') return interaction.showModal(buildSettingModal('timezone', await currentSetting(interaction.user.id, 'timezone')));
   },
} satisfies ComponentHandler;

async function toggleBoolean(interaction: ButtonInteraction, key: string): Promise<void> {
   if (!(BOOLEAN_SETTING_KEYS as readonly string[]).includes(key)) {
      await interaction.reply({ content: 'That switch no longer exists.', ...ephemeral });
      return;
   }

   const settingKey = key as BooleanSettingKey;
   const settings = await accountService.getSettings(interaction.user.id);
   await accountService.updateSetting(interaction.user.id, settingKey, !settings[settingKey]);

   await interaction.update(await fetchProfilePanel(interaction.user.id, interaction.user.displayName));
}

async function cycleUnits(interaction: ButtonInteraction): Promise<void> {
   const settings = await accountService.getSettings(interaction.user.id);
   const next: UnitSystem = settings.units === 'imperial' ? 'metric' : 'imperial';
   await accountService.updateSetting(interaction.user.id, 'units', next);

   await interaction.update(await fetchProfilePanel(interaction.user.id, interaction.user.displayName));
}

async function saveText(interaction: ModalSubmitInteraction, field: SettingField): Promise<void> {
   const raw = interaction.fields.getTextInputValue('value').trim();
   const value = raw.length > 0 ? raw : null;

   // A timezone must be a real IANA zone or later time features break — reject
   // an unknown one without touching the panel.
   if (field === 'timezone' && value !== null && !isValidTimeZone(value)) {
      await interaction.reply({ content: `**${value}** isn't a timezone I know. Use an IANA name like \`Europe/Warsaw\`.`, ...ephemeral });
      return;
   }

   await accountService.updateSetting(interaction.user.id, field, value);

   const panel = await fetchProfilePanel(interaction.user.id, interaction.user.displayName);
   // The modal was opened from the panel message, so repaint it in place; fall
   // back to a fresh ephemeral panel if somehow not (never happens today).
   if (interaction.isFromMessage())
      await interaction.update(panel);
   else
      await interaction.reply({ ...panel, ...ephemeral });
}

async function currentSetting(userId: string, field: SettingField): Promise<string | null> {
   const settings = await accountService.getSettings(userId);
   return settings[field];
}
