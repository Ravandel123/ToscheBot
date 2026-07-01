import OpenAI from 'openai';
import { config } from '../config.js';
import { log } from '../lib/log.js';

export interface AiMessage {
   role: 'system' | 'user' | 'assistant';
   content: string;
}

// Behind an interface (D8) so the persona could later swap providers without
// touching the trigger code. When there's no API key the service is disabled
// and the bot runs normally.
export interface AiService {
   readonly enabled: boolean;
   respond(messages: AiMessage[]): Promise<string>;
}

export function createAiService(): AiService {
   if (!config.openaiApiKey) {
      log.info('AI persona disabled (no OPENAI_API_KEY set).');
      return {
         enabled: false,
         respond: () => Promise.reject(new Error('AI persona is disabled.')),
      };
   }

   const client = new OpenAI({ apiKey: config.openaiApiKey });
   log.info(`AI persona enabled (model: ${config.openaiModel}).`);

   return {
      enabled: true,
      async respond(messages) {
         const completion = await client.chat.completions.create({
            model: config.openaiModel,
            messages,
         });

         return completion.choices[0]?.message.content ?? '';
      },
   };
}
