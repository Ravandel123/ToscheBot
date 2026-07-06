import type { PrefixCommand } from '../../../types/commands.js';
import { locateComic } from '../../../fun/comic.js';
import { buildComicMessage } from '../../components/_comicView.js';

// Opens an interactive Beyond the Western Deep comic browser. The buttons/selects
// are handled statelessly by the `comic` component handler, so the browser keeps
// working indefinitely (no collector to expire). Optional arg jumps straight to a
// chapter / page / the latest page / a random page.
export default {
   name: 'comic',
   aliases: ['btwd'],
   description: 'Browse the Beyond the Western Deep webcomic.',
   usage: 'comic [chapter | latest | random]',
   category: 'fun',
   async execute(message, args) {
      const { chapter, page } = locateComic(args[0]);
      await message.reply(buildComicMessage(chapter, page));
   },
} satisfies PrefixCommand;
