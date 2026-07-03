import { MessageFlags } from 'discord.js';
import { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { DEFAULT_ACCOUNT_SETTINGS, type AccountSettings } from '../../db/models/account.js';
import { fetchProfilePanel } from './_profilePanel.js';

// Handles `profile:toggle:<settingKey>` from the account panel (D27). The panel
// is ephemeral, so the clicker is always the account owner — toggling reads the
// CURRENT value and flips it, then repaints the whole panel.
export default {
   namespace: 'profile',
   async handle(_client, interaction) {
      if (!interaction.isButton())
         return;

      const [, action, key] = interaction.customId.split(':');
      if (action !== 'toggle' || !(key in DEFAULT_ACCOUNT_SETTINGS)) {
         await interaction.reply({ content: 'That switch no longer exists.', flags: MessageFlags.Ephemeral });
         return;
      }

      const settingKey = key as keyof AccountSettings;
      const settings = await accountService.getSettings(interaction.user.id);
      await accountService.updateSetting(interaction.user.id, settingKey, !settings[settingKey]);

      await interaction.update(await fetchProfilePanel(interaction.user.id, interaction.user.displayName));
   },
} satisfies ComponentHandler;
