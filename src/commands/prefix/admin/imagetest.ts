import { AttachmentBuilder, type Message } from 'discord.js';
import type { PrefixCommand } from '../../../types/commands.js';
import { renderCardSpinGif } from '../../../game/images/animate.js';
import { renderSmokeTest } from '../../../game/images/smokeTest.js';

async function replyWithGifDemo(message: Message): Promise<void> {
   const startedAt = Date.now();
   const gif = await renderCardSpinGif({ rank: 'A', suit: 'spades' }, { turns: 2 });

   await message.reply({
      content: `🎞️ Animated GIF works on this host — rendered in ${Date.now() - startedAt} ms (${Math.round(gif.length / 1024)} KB).`,
      files: [new AttachmentBuilder(gif, { name: 'composite-gif-test.gif' })],
   });
}

async function replyWithStaticDemo(message: Message): Promise<void> {
   const report = await renderSmokeTest();
   const fontLine = report.fontFamilyCount === 0
      ? '⚠️ No fonts found — text renders blank. Drop a .ttf into assets/fonts/ and redeploy.'
      : `Fonts: ${report.fontFamilyCount} families, text uses '${report.fontFamily}'.`;

   await message.reply({
      content: `🖼️ Compositing works on this host. Rendered in ${report.renderMs} ms (${Math.round(report.png.length / 1024)} KB).\n${fontLine}\n(Try \`h!imagetest gif\` for the animation test.)`,
      files: [new AttachmentBuilder(report.png, { name: 'composite-smoke-test.png' })],
   });
}

export default {
   name: 'imagetest',
   description: 'Render a throwaway test composite (or `gif` for an animated one) — proves the image pipeline works on this host.',
   category: 'admin',
   ownerOnly: true,
   async execute(message, args) {
      if (args[0]?.toLowerCase() === 'gif')
         return replyWithGifDemo(message);
      return replyWithStaticDemo(message);
   },
} satisfies PrefixCommand;
