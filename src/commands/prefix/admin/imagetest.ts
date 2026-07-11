import { AttachmentBuilder } from 'discord.js';
import type { PrefixCommand } from '../../../types/commands.js';
import { renderSmokeTest } from '../../../game/images/composite.js';

export default {
   name: 'imagetest',
   description: 'Render a throwaway test composite — proves the image-compositing pipeline (@napi-rs/canvas) works on this host.',
   category: 'admin',
   ownerOnly: true,
   async execute(message) {
      const png = await renderSmokeTest();
      await message.reply({
         content: '🖼️ Compositing works on this host.',
         files: [new AttachmentBuilder(png, { name: 'composite-smoke-test.png' })],
      });
   },
} satisfies PrefixCommand;
