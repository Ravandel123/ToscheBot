// Discord adapter (marked): the account panel (D27) — what `/profile` shows and
// the `profile:toggle:*` buttons repaint. The ACCOUNT is the Discord user
// (settings, active character pointer); character sheets moved to
// `/character view`. Stateless: the panel is ephemeral and personal, so the
// clicking user IS the account owner — no ids ride in the customIds.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import { accountService } from '../../db/services/accountService.js';
import { characterService } from '../../db/services/characterService.js';
import { accountSettings, type AccountSettings } from '../../db/models/account.js';
import { MAX_CHARACTERS_PER_ACCOUNT } from '../../game/character/rules.js';
import { displayName, STATUS_LABEL } from '../../game/character/identity.js';

const PANEL_COLOR = 0x4E6E58; // quartermaster ledger green

interface SettingMeta {
   label: string;
   description: string;
   emoji: string;
}

// One entry per AccountSettings key — the embed and the toggle buttons render
// from this map, so adding a setting = model field + one line here.
export const SETTING_META: Record<keyof AccountSettings, SettingMeta> = {
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

   const settingLines = (Object.keys(SETTING_META) as (keyof AccountSettings)[])
      .map((key) => {
         const meta = SETTING_META[key];
         return `${settings[key] ? '✅' : '⛔'} ${meta.emoji} **${meta.label}** — ${meta.description}`;
      })
      .join('\n');

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
         { name: 'Settings', value: settingLines },
      )
      .setFooter({ text: 'Toggle settings below · characters live under /character' });

   const buttons = (Object.keys(SETTING_META) as (keyof AccountSettings)[]).map((key) =>
      new ButtonBuilder()
         .setCustomId(`profile:toggle:${key}`)
         .setLabel(`${SETTING_META[key].label}: ${settings[key] ? 'ON' : 'OFF'}`)
         .setEmoji(SETTING_META[key].emoji)
         .setStyle(settings[key] ? ButtonStyle.Success : ButtonStyle.Secondary),
   );

   return {
      embeds: [embed],
      components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons)],
   };
}
