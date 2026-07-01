import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import path from 'node:path';
import { loadDefaultExports } from './core/loader.js';
import { CooldownManager } from './core/cooldowns.js';
import { PlayerLockManager } from './core/locks.js';
import { validateJobs } from './core/scheduler.js';
import { createAiService, type AiService } from './ai/aiService.js';
import { PrefixCommand, SlashCommand } from './types/commands.js';
import { ComponentHandler } from './types/interactions.js';
import { BotEvent } from './types/events.js';
import { CronJob } from './types/jobs.js';
import { log } from './lib/log.js';

export class ToscheClient extends Client {
   readonly prefixCommands = new Collection<string, PrefixCommand>();
   readonly slashCommands = new Collection<string, SlashCommand>();
   // Button/select/modal handlers, keyed by customId namespace (see types/interactions.ts).
   readonly componentHandlers = new Collection<string, ComponentHandler>();
   readonly cooldowns = new CooldownManager();
   readonly locks = new PlayerLockManager();
   readonly ai: AiService = createAiService();
   // Started by the clientReady event, so jobs never fire on a half-ready client.
   jobs: CronJob[] = [];

   private readonly aliases = new Map<string, string>();

   constructor() {
      super({
         intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.GuildExpressions,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageReactions,
            GatewayIntentBits.MessageContent
         ],
         partials: [
            Partials.Channel,
            Partials.GuildMember,
            Partials.Message,
            Partials.Reaction,
            Partials.ThreadMember,
            Partials.User
         ],
      });
   }

   resolvePrefixCommand(nameOrAlias: string): PrefixCommand | undefined {
      return this.prefixCommands.get(nameOrAlias)
         ?? this.prefixCommands.get(this.aliases.get(nameOrAlias) ?? '');
   }

   async init(): Promise<void> {
      const srcDir = import.meta.dirname;

      await this.loadPrefixCommands(path.join(srcDir, 'commands', 'prefix'));
      await this.loadSlashCommands(path.join(srcDir, 'commands', 'slash'));
      await this.loadComponentHandlers(path.join(srcDir, 'commands', 'components'));
      await this.registerEvents(path.join(srcDir, 'events'));

      this.jobs = await loadDefaultExports<CronJob>(path.join(srcDir, 'jobs'));
      validateJobs(this.jobs);

      log.info(`Loaded ${this.prefixCommands.size} prefix commands, ${this.slashCommands.size} slash commands, ${this.componentHandlers.size} component handlers, ${this.jobs.length} jobs.`);
   }

   private async loadPrefixCommands(dir: string): Promise<void> {
      for (const command of await loadDefaultExports<PrefixCommand>(dir)) {
         this.registerKey(command.name, `prefix command '${command.name}'`);
         this.prefixCommands.set(command.name, command);

         for (const alias of command.aliases ?? []) {
            this.registerKey(alias, `alias '${alias}' of '${command.name}'`);
            this.aliases.set(alias, command.name);
         }
      }
   }

   private async loadSlashCommands(dir: string): Promise<void> {
      for (const command of await loadDefaultExports<SlashCommand>(dir)) {
         const name = command.data.name;

         if (this.slashCommands.has(name))
            throw new Error(`Duplicate slash command '${name}'.`);

         this.slashCommands.set(name, command);
      }
   }

   private async loadComponentHandlers(dir: string): Promise<void> {
      for (const handler of await loadDefaultExports<ComponentHandler>(dir)) {
         if (this.componentHandlers.has(handler.namespace))
            throw new Error(`Duplicate component handler namespace '${handler.namespace}'.`);

         this.componentHandlers.set(handler.namespace, handler);
      }
   }

   private async registerEvents(dir: string): Promise<void> {
      for (const event of await loadDefaultExports<BotEvent>(dir)) {
         // Single widening cast at the dispatch boundary: discord.js
         // guarantees the emitted args match event.name.
         const dispatch = event as { execute(client: ToscheClient, ...args: unknown[]): Promise<void> | void };

         const listener = (...args: unknown[]): void => {
            Promise.resolve(dispatch.execute(this, ...args)).catch((error: unknown) => {
               log.error(`Error in event '${event.name}':`, error);
            });
         };

         if (event.once)
            this.once(event.name, listener);
         else
            this.on(event.name, listener);
      }
   }

   private registerKey(key: string, description: string): void {
      if (this.prefixCommands.has(key) || this.aliases.has(key))
         throw new Error(`Duplicate prefix command name/alias: ${description}.`);
   }
}
