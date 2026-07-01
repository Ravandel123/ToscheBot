// Discord adapter (marked): builds the comic-browser message — the page embed
// plus the navigation buttons and chapter/page select menus. Shared by the
// `h!comic` command (initial send) and the `comic` component handler (updates).
// Navigation is *stateless*: the current chapter+page are encoded in the button
// customIds, so the browser survives restarts and never "closes" (an improvement
// over the old 1-hour collector). Underscore prefix → the loader skips it.
import {
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   EmbedBuilder,
   StringSelectMenuBuilder,
   type MessageActionRowComponentBuilder,
} from 'discord.js';
import {
   COMIC,
   COMIC_CHAPTER_IDS,
   clampPage,
   lastPageIndex,
   pageImageUrl,
   pageOfficialUrl,
   resolveChapterId,
   type ComicChapterId,
} from '../../fun/comic.js';

const COMIC_COLOR = 0x8A6D3B; // muted sepia — fits BtWD's tone
const MAX_PAGE_OPTIONS = 25; // Discord's hard cap on select options

export interface ComicMessage {
   embeds: EmbedBuilder[];
   components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

/** Builds the full browser message for a (chapter, page). Both are resolved/clamped, so callers can pass raw input. */
export function buildComicMessage(chapterInput: string, pageInput: number): ComicMessage {
   const chapter = resolveChapterId(chapterInput);
   const page = clampPage(chapter, pageInput);
   const last = lastPageIndex(chapter);

   const embed = new EmbedBuilder()
      .setColor(COMIC_COLOR)
      .setTitle(`${COMIC[chapter].name} — ${page === 0 ? 'Title' : `Page ${page}`}`)
      .setURL(pageOfficialUrl(chapter, page))
      .setImage(pageImageUrl(chapter, page))
      .setFooter({ text: `Page ${page} / ${last} · Beyond the Western Deep — support the artists at westerndeep.net` });

   return {
      embeds: [embed],
      components: [navRow(chapter, page, last), selectRow(chapterMenu(chapter)), selectRow(pageMenu(chapter, page))],
   };
}

function navRow(chapter: ComicChapterId, page: number, last: number): ActionRowBuilder<MessageActionRowComponentBuilder> {
   const show = (target: number): string => `comic:show:${chapter}:${target}`;

   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(show(0)).setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(show(Math.max(0, page - 1))).setEmoji('⬅️').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId('comic:random').setEmoji('🎲').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(show(Math.min(last, page + 1))).setEmoji('➡️').setStyle(ButtonStyle.Primary).setDisabled(page === last),
      new ButtonBuilder().setCustomId(show(last)).setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page === last),
   );
}

function chapterMenu(current: ComicChapterId): StringSelectMenuBuilder {
   return new StringSelectMenuBuilder()
      .setCustomId('comic:chapter')
      .setPlaceholder('Change chapter')
      .addOptions(COMIC_CHAPTER_IDS.map((id) => ({ label: COMIC[id].name, value: id, default: id === current })));
}

function pageMenu(chapter: ComicChapterId, page: number): StringSelectMenuBuilder {
   const total = lastPageIndex(chapter) + 1;
   const step = Math.max(1, Math.ceil(total / MAX_PAGE_OPTIONS));
   const options = [];

   for (let i = 0; i < total; i += step)
      options.push({ label: i === 0 ? 'Title' : `Page ${i}`, value: String(i), default: i === page });

   return new StringSelectMenuBuilder().setCustomId(`comic:page:${chapter}`).setPlaceholder('Jump to a page').addOptions(options);
}

function selectRow(menu: StringSelectMenuBuilder): ActionRowBuilder<MessageActionRowComponentBuilder> {
   return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}
