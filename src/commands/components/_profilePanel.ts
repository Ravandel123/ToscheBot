// Discord adapter (marked): the account panel (D27/R19) — what `/profile` shows
// and the `profile:*` controls repaint. The ACCOUNT is the Discord user
// (server-wide settings, active character pointer); character sheets moved to
// `/character view`. Stateless: the panel is ephemeral and personal, so the
// clicking user IS the account owner — no ids ride in the customIds.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import { accountService } from '../../db/services/accountService.js';
import { characterService } from '../../db/services/characterService.js';
import { accountSettings, BOOLEAN_SETTING_KEYS, type BooleanSettingKey } from '../../db/models/account.js';
import { MAX_CHARACTERS_PER_ACCOUNT } from '../../game/character/rules.js';
import { displayName, STATUS_LABEL } from '../../game/character/identity.js';

const PANEL_COLOR = 0x4E6E58; // quartermaster ledger green

interface SettingMeta {
   label: string;
   description: string;
   emoji: string;
}

// One entry per BOOLEAN setting — the toggle lines and buttons render from this
// map, so adding a boolean setting = model field + BOOLEAN_SETTING_KEYS entry +
// one line here. Non-boolean settings (units/country/timezone) have their own
// controls below.
export const BOOLEAN_SETTING_META: Record<BooleanSettingKey, SettingMeta> = {
   activeGame: {
      label: 'Game events',
      description: 'Random game events on the server may involve you.',
      emoji: '🎲',
   },
   dmNotifications: {
      label: 'DM notifications',
      description: 'The bot may DM you (approval verdicts, game news).',
      emoji: '✉️',
   },
};

export interface ProfilePanel {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** Fetches everything the account panel shows and builds it (onboards the caller). */
export async function fetchProfilePanel(userId: string, username: string): Promise<ProfilePanel> {
   const account = await accountService.getOrCreate(userId, username);
   const active = account.activeCharacterId ? await characterService.get(account.activeCharacterId) : null;
   const owned = await characterService.countOwned(userId);
   const settings = accountSettings(account);

   const toggleLines = BOOLEAN_SETTING_KEYS
      .map((key) => {
         const meta = BOOLEAN_SETTING_META[key];
         return `${settings[key] ? '✅' : '⛔'} ${meta.emoji} **${meta.label}** — ${meta.description}`;
      })
      .join('\n');

   const preferenceLines = [
      `📏 **Units:** ${settings.units === 'imperial' ? 'Imperial' : 'Metric'}`,
      `🌍 **Country:** ${settings.country ?? '—'}`,
      `🕒 **Timezone:** ${settings.timezone ?? '—'}`,
   ].join('\n');

   const embed = new EmbedBuilder()
      .setColor(PANEL_COLOR)
      .setTitle(`⚙️ ${account.username} — account`)
      .addFields(
         {
            name: 'Active character',
            value: active ? `**${displayName(active)}** · ${STATUS_LABEL[active.approvalStatus]}` : '—',
            inline: true,
         },
         { name: 'Characters', value: `${owned}/${MAX_CHARACTERS_PER_ACCOUNT}`, inline: true },
         { name: 'Settings', value: toggleLines },
         { name: 'Preferences', value: preferenceLines },
      )
      .setFooter({ text: 'Settings apply server-wide · characters live under /character' });

   const toggleButtons = BOOLEAN_SETTING_KEYS.map((key) =>
      new ButtonBuilder()
         .setCustomId(`profile:toggle:${key}`)
         .setLabel(`${BOOLEAN_SETTING_META[key].label}: ${settings[key] ? 'ON' : 'OFF'}`)
         .setEmoji(BOOLEAN_SETTING_META[key].emoji)
         .setStyle(settings[key] ? ButtonStyle.Success : ButtonStyle.Secondary),
   );

   const preferenceButtons = [
      new ButtonBuilder()
         .setCustomId('profile:units')
         .setLabel(`Units: ${settings.units === 'imperial' ? 'Imperial' : 'Metric'}`)
         .setEmoji('📏')
         .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('profile:country').setLabel('Set country').setEmoji('🌍').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('profile:timezone').setLabel('Set timezone').setEmoji('🕒').setStyle(ButtonStyle.Secondary),
   ];

   return {
      embeds: [embed],
      components: [
         new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(toggleButtons),
         new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(preferenceButtons),
      ],
   };
}
