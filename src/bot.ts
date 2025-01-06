require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

const client = new Client({
   intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildEmojisAndStickers,
      // GatewayIntentBits.GuildIntegrations,
      // GatewayIntentBits.GuildWebhooks,
      // GatewayIntentBits.GuildInvites,
      // GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessageTyping,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.DirectMessageTyping,
      GatewayIntentBits.MessageContent
      // GatewayIntentBits.GuildScheduledEvents,
      // GatewayIntentBits.AutoModerationConfiguration,
      // GatewayIntentBits.AutoModerationExecution,
   ],
   partials: [
      Partials.Channel,
      Partials.Guild,
      Partials.GuildMember,
      Partials.Message,
      Partials.Reaction,
      Partials.ThreadMember,
      Partials.User
   ],
});




client.login(process.env.BOT_TOKEN);