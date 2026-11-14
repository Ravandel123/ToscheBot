// The "Back to /play" button the character's own top-level panels carry (pack,
// skills, fighting style). It routes to `play:hub`, which repaints the same
// message as the hub — so a panel opened from a hub shortcut returns to it, and
// one opened by its slash command becomes a hub. Underscore prefix → loader
// skips it.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   type MessageActionRowComponentBuilder,
} from 'discord.js';

export function backToPlayButton(): ButtonBuilder {
   return new ButtonBuilder().setCustomId('play:hub').setLabel('Back to /play').setEmoji('↩️').setStyle(ButtonStyle.Secondary);
}

export function backToPlayRow(): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(backToPlayButton());
}
