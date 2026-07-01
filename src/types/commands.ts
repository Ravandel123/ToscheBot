import {
   AutocompleteInteraction,
   ChatInputCommandInteraction,
   Message,
   PermissionResolvable,
   SlashCommandBuilder,
   SlashCommandOptionsOnlyBuilder,
   SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { ToscheClient } from '../client.js';

export type PrefixCategory = 'fun' | 'utility' | 'admin';

export interface PrefixCommand {
   name: string;
   aliases?: string[];
   description: string;
   usage?: string;
   category: PrefixCategory;
   ownerOnly?: boolean;
   requiredPermissions?: PermissionResolvable[];
   cooldownSeconds?: number;
   execute(message: Message, args: string[]): Promise<void>;
}

// Builder methods narrow the type (.addStringOption() returns
// SlashCommandOptionsOnlyBuilder, not SlashCommandBuilder), so `data`
// must accept the whole family.
export type AnySlashCommandBuilder =
   | SlashCommandBuilder
   | SlashCommandOptionsOnlyBuilder
   | SlashCommandSubcommandsOnlyBuilder;

export interface SlashCommand {
   data: AnySlashCommandBuilder;
   category: 'game';
   ownerOnly?: boolean;
   cooldownSeconds?: number;
   execute(client: ToscheClient, interaction: ChatInputCommandInteraction): Promise<void>;
   autocomplete?(client: ToscheClient, interaction: AutocompleteInteraction): Promise<void>;
}
