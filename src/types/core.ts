export interface BotConfig {
   token: string;
   clientId: string;
   guildId: string;
   ownerId: string;
   mongodbUri: string;
   prefix: string;
   /** Optional — when absent, the AI persona stays disabled (the bot still runs). */
   openaiApiKey?: string;
   openaiModel: string;
   /** Names the AI persona answers to, when overridden by `AI_TRIGGER_NAMES`. */
   aiTriggerNames?: string[];
}
