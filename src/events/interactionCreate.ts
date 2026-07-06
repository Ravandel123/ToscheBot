import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { defineEvent } from '../types/events.js';
import { config } from '../config.js';
import { log } from '../lib/log.js';
import type { ComponentInteraction } from '../types/interactions.js';
import type { ToscheClient } from '../client.js';

export default defineEvent({
   name: 'interactionCreate',
   async execute(client, interaction) {
      if (interaction.isChatInputCommand()) {
         await handleChatInput(client, interaction);
         return;
      }

      if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
         await handleComponent(client, interaction);
         return;
      }

      if (interaction.isAutocomplete()) {
         const command = client.slashCommands.get(interaction.commandName);

         try {
            await command?.autocomplete?.(client, interaction);
         } catch (error) {
            log.error(`Autocomplete for '${interaction.commandName}' failed:`, error);
         }
      }
   },
});

async function handleComponent(client: ToscheClient, interaction: ComponentInteraction): Promise<void> {
   const namespace = interaction.customId.split(':')[0];
   const handler = client.componentHandlers.get(namespace);

   if (!handler) {
      // A component from an old message whose handler no longer exists — ignore quietly.
      log.warn(`No component handler for namespace '${namespace}' (customId '${interaction.customId}').`);
      return;
   }

   try {
      await handler.handle(client, interaction);
   } catch (error) {
      log.error(`Component handler '${namespace}' failed:`, error);

      const reply = { content: 'Something went wrong on my end. The scribes have been notified.', flags: MessageFlags.Ephemeral } as const;

      try {
         if (interaction.replied || interaction.deferred)
            await interaction.followUp(reply);
         else
            await interaction.reply(reply);
      } catch {
         // Interaction may have expired, or was already acknowledged by a modal; the log is enough.
      }
   }
}

async function handleChatInput(client: ToscheClient, interaction: ChatInputCommandInteraction): Promise<void> {
   const command = client.slashCommands.get(interaction.commandName);

   if (!command) {
      // Registered on Discord but missing in code — stale registration; rerun `npm run deploy`.
      log.warn(`Received unknown slash command '${interaction.commandName}'.`);
      await interaction.reply({ content: 'I do not know that order anymore.', flags: MessageFlags.Ephemeral });
      return;
   }

   const isOwner = interaction.user.id === config.ownerId;

   if (command.ownerOnly && !isOwner) {
      await interaction.reply({ content: 'Only the Imperator gives me orders, yes-yes.', flags: MessageFlags.Ephemeral });
      return;
   }

   const remaining = isOwner
      ? 0
      : client.cooldowns.use(`s:${interaction.commandName}`, interaction.user.id, command.cooldownSeconds ?? 0);

   if (remaining > 0) {
      await interaction.reply({ content: `Patience! Try again in ${remaining.toFixed(1)}s.`, flags: MessageFlags.Ephemeral });
      return;
   }

   try {
      await command.execute(client, interaction);
   } catch (error) {
      log.error(`Slash command '${interaction.commandName}' failed:`, error);

      const reply = { content: 'Something went wrong on my end. The scribes have been notified.', flags: MessageFlags.Ephemeral } as const;

      try {
         if (interaction.deferred || interaction.replied)
            await interaction.followUp(reply);
         else
            await interaction.reply(reply);
      } catch {
         // Interaction may have expired; the log line above is enough.
      }
   }
}
