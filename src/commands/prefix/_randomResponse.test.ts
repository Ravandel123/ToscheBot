import { afterEach, describe, expect, it, vi } from 'vitest';
import { Message } from 'discord.js';
import { defineRandomResponseCommand } from './_randomResponse.js';

afterEach(() => {
   vi.restoreAllMocks();
});

function fakeMessage(): { message: Message; reply: ReturnType<typeof vi.fn> } {
   const reply = vi.fn<(content: string) => Promise<void>>().mockResolvedValue(undefined);
   const message = { reply, channel: { isSendable: () => false } } as unknown as Message;
   return { message, reply };
}

describe('defineRandomResponseCommand', () => {
   it('carries metadata through and defaults the category to fun', () => {
      const command = defineRandomResponseCommand({
         name: 'test',
         aliases: ['t'],
         description: 'x',
         responses: ['only'],
      });

      expect(command.name).toBe('test');
      expect(command.aliases).toEqual(['t']);
      expect(command.category).toBe('fun');
   });

   it('replies with a line from the pool', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // picks the first entry
      const { message, reply } = fakeMessage();

      const command = defineRandomResponseCommand({ name: 'a', description: 'x', responses: ['first', 'second'] });
      await command.execute(message, []);

      expect(reply).toHaveBeenCalledWith('first');
   });

   it('includes dynamically generated extra responses', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // last entry of the pool
      const { message, reply } = fakeMessage();

      const command = defineRandomResponseCommand({
         name: 'a',
         description: 'x',
         responses: ['canned'],
         extraResponses: () => ['dynamic'],
      });
      await command.execute(message, []);

      expect(reply).toHaveBeenCalledWith('dynamic');
   });

   it('never appends the funny tic to a URL response', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const { message, reply } = fakeMessage();

      const command = defineRandomResponseCommand({
         name: 'a',
         description: 'x',
         responses: ['https://example.com/gif'],
         funny: true,
      });
      await command.execute(message, []);

      expect(reply).toHaveBeenCalledWith('https://example.com/gif');
   });
});
