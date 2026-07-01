import { Message } from 'discord.js';
import type { ToscheClient } from '../client.js';
import { settings } from '../settings.js';
import { chance } from '../lib/random.js';
import { replyChunked } from '../lib/discord.js';
import { log } from '../lib/log.js';
import { PERSONA_PROMPT } from './persona.js';
import type { AiMessage } from './aiService.js';

const triggerNames = settings.ai.triggerNames as readonly string[];
const aiChannels = settings.ai.channels as readonly string[];
const silentChannels = settings.ai.silentChannels as readonly string[];

/**
 * Decides whether Tosche should reply with the AI persona, and if so, does it.
 * Triggers: message text starts with his name, the message is in a dedicated AI
 * channel, or (rarely) an ambient random roll. Silent on its own in
 * `silentChannels`. No-op if the AI service is disabled (no API key).
 */
export async function maybeRespondWithAi(client: ToscheClient, message: Message): Promise<void> {
   if (!client.ai.enabled)
      return;

   const text = message.content.trim();
   if (!text)
      return;

   const channelName = ('name' in message.channel ? message.channel.name : '') ?? '';
   const lower = text.toLowerCase();

   const nameTrigger = triggerNames.some((name) => lower.startsWith(name));
   const channelTrigger = aiChannels.includes(channelName);
   const ambient = !silentChannels.includes(channelName) && chance(settings.ai.ambientChancePercent);

   if (!nameTrigger && !channelTrigger && !ambient)
      return;

   try {
      if (message.channel.isSendable())
         await message.channel.sendTyping();

      const history = await buildHistory(message);
      const reply = await client.ai.respond([{ role: 'system', content: PERSONA_PROMPT }, ...history]);

      // The persona asks for short replies, but the model can overshoot the
      // 2000-char message limit — split instead of erroring.
      if (reply)
         await replyChunked(message, reply);
   } catch (error) {
      log.error('AI response failed:', error);
   }
}

// Feeds the model the last few messages as context, labelling who said what.
async function buildHistory(message: Message): Promise<AiMessage[]> {
   const fetched = await message.channel.messages.fetch({ limit: settings.ai.historyLimit });

   return [...fetched.values()].reverse().map((msg): AiMessage =>
      msg.author.bot
         ? { role: 'assistant', content: msg.content }
         : { role: 'user', content: `${msg.member?.displayName ?? msg.author.username}: ${msg.content}` },
   );
}
