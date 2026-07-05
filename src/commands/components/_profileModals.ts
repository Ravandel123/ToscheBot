// Discord adapter (marked): the free-text modals behind the `/profile` panel's
// "Set country" / "Set timezone" buttons (R19). A single text field each; the
// submit routes to `profile:set-<field>`, which validates + saves and repaints
// the panel in place. Underscore prefix → loader skips it.
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export const COUNTRY_MAX_LENGTH = 56; // longest real country name fits comfortably
export const TIMEZONE_MAX_LENGTH = 64;

const FIELD = {
   country: { title: 'Set your country', label: 'Country', placeholder: 'e.g. Poland', max: COUNTRY_MAX_LENGTH },
   timezone: { title: 'Set your timezone', label: 'IANA timezone', placeholder: 'e.g. Europe/Warsaw', max: TIMEZONE_MAX_LENGTH },
} as const;

export type SettingField = keyof typeof FIELD;

export function buildSettingModal(field: SettingField, current: string | null): ModalBuilder {
   const meta = FIELD[field];
   const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel(meta.label)
      .setStyle(TextInputStyle.Short)
      .setRequired(false) // empty clears the setting
      .setMaxLength(meta.max)
      .setPlaceholder(meta.placeholder);
   if (current)
      input.setValue(current);

   return new ModalBuilder()
      .setCustomId(`profile:set-${field}`)
      .setTitle(meta.title)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}
