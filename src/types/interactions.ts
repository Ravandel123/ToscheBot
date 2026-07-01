import type { AnySelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import type { ToscheClient } from '../client.js';

// Buttons, select menus and modal submits all carry a `customId`. We namespace
// it as `<namespace>:<action>[:...args]`; the first segment routes the
// interaction to the handler that owns it (parallel to how slash commands route
// by name). Handlers live one-per-file in `commands/components/`.
export type ComponentInteraction = ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction;

export interface ComponentHandler {
   /** First `:`-separated segment of the customIds this handler owns (e.g. 'character'). */
   namespace: string;
   handle(client: ToscheClient, interaction: ComponentInteraction): Promise<void>;
}
