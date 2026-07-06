import type { ComponentHandler } from '../../types/interactions.js';
import { randomComicLocation } from '../../fun/comic.js';
import { buildComicMessage } from './_comicView.js';

// Routes every `comic:*` button/select. State (chapter+page) rides in the
// customId, so each interaction just rebuilds the browser for the new location —
// no per-message collector, works forever, shared by anyone who clicks.
export default {
   namespace: 'comic',
   async handle(_client, interaction) {
      const [, action, chapter, arg] = interaction.customId.split(':');

      if (interaction.isButton()) {
         if (action === 'random') {
            const { chapter: target, page } = randomComicLocation();
            await interaction.update(buildComicMessage(target, page));
            return;
         }
         if (action === 'show') {
            await interaction.update(buildComicMessage(chapter, Number(arg)));
            return;
         }
      }

      if (interaction.isStringSelectMenu()) {
         if (action === 'chapter') {
            await interaction.update(buildComicMessage(interaction.values[0], 0));
            return;
         }
         if (action === 'page') {
            await interaction.update(buildComicMessage(chapter, Number(interaction.values[0])));
            return;
         }
      }
   },
} satisfies ComponentHandler;
