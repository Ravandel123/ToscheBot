import { CharacterLockManager } from '../core/locks.js';
import type {
   AnySelectMenuInteraction,
   ButtonInteraction,
   ModalSubmitInteraction,
} from 'discord.js';
import type { ComponentInteraction } from '../types/interactions.js';
import type { ToscheClient } from '../client.js';

// Layer-2 test harness (CLAUDE.md "Testing interaction flows"): minimal fake
// button / select / modal interactions that record what a handler replies,
// updates, or shows — so a whole flow (click → handler → service → DB → repaint)
// runs headless against the in-memory DB (useTestDb), no gateway, no real client.
// It fakes ONLY what the handlers touch; it does not reproduce Discord's real API
// behaviour (the ack window, ephemeral semantics, permissions) — those stay a
// manual smoke test (see przewodnik.md).

/** Everything a handler did to an interaction — assert against this. */
export interface Captured {
   /** Payloads passed to `interaction.reply(...)`. */
   replies: unknown[];
   /** Payloads passed to `interaction.update(...)` or `editReply(...)` (panel repaints). */
   updates: unknown[];
   /** Payloads passed to `interaction.followUp(...)`. */
   followUps: unknown[];
   /** Modals passed to `interaction.showModal(...)`. */
   modals: unknown[];
   deferredUpdate: boolean;
   deferredReply: boolean;
}

export interface FakeInteractionOptions {
   userId?: string;
   displayName?: string;
   username?: string;
   /** For a modal opened from a panel message (drives `isFromMessage()`). Default true. */
   fromMessage?: boolean;
}

interface FakeBase extends FakeInteractionOptions {
   customId: string;
   user: { id: string; displayName: string; username: string };
   replied: boolean;
   deferred: boolean;
   message: { id: string } | null;
   values?: string[];
   fields?: { getTextInputValue(id: string): string };
   isChatInputCommand(): boolean;
   isButton(): boolean;
   isAnySelectMenu(): boolean;
   isStringSelectMenu(): boolean;
   isModalSubmit(): boolean;
   isFromMessage(): boolean;
   reply(payload: unknown): Promise<void>;
   update(payload: unknown): Promise<void>;
   editReply(payload: unknown): Promise<unknown>;
   followUp(payload: unknown): Promise<unknown>;
   deferUpdate(): Promise<void>;
   deferReply(): Promise<void>;
   showModal(modal: unknown): Promise<void>;
}

function buildBase(customId: string, options: FakeInteractionOptions): { base: FakeBase; captured: Captured } {
   const captured: Captured = { replies: [], updates: [], followUps: [], modals: [], deferredUpdate: false, deferredReply: false };
   const userId = options.userId ?? 'test-user';
   const fromMessage = options.fromMessage ?? true;

   const base: FakeBase = {
      customId,
      user: { id: userId, displayName: options.displayName ?? userId, username: options.username ?? options.displayName ?? userId },
      replied: false,
      deferred: false,
      message: fromMessage ? { id: 'fake-message' } : null,
      isChatInputCommand: () => false,
      isButton: () => false,
      isAnySelectMenu: () => false,
      isStringSelectMenu: () => false,
      isModalSubmit: () => false,
      isFromMessage: () => fromMessage,
      reply: async (payload) => { captured.replies.push(payload); base.replied = true; },
      update: async (payload) => { captured.updates.push(payload); base.replied = true; },
      editReply: async (payload) => { captured.updates.push(payload); return payload; },
      followUp: async (payload) => { captured.followUps.push(payload); return payload; },
      deferUpdate: async () => { base.deferred = true; captured.deferredUpdate = true; },
      deferReply: async () => { base.deferred = true; captured.deferredReply = true; },
      showModal: async (modal) => { captured.modals.push(modal); base.replied = true; },
   };

   return { base, captured };
}

export interface FakeInteraction<T> {
   interaction: T;
   captured: Captured;
}

/** A fake button click (`customId` routes to the handler under test). */
export function fakeButton(customId: string, options: FakeInteractionOptions = {}): FakeInteraction<ButtonInteraction> {
   const { base, captured } = buildBase(customId, options);
   base.isButton = () => true;
   return { interaction: base as unknown as ButtonInteraction, captured };
}

/** A fake select-menu choice; `values` are the picked option values. */
export function fakeSelect(customId: string, values: string[], options: FakeInteractionOptions = {}): FakeInteraction<AnySelectMenuInteraction> {
   const { base, captured } = buildBase(customId, options);
   base.values = values;
   base.isAnySelectMenu = () => true;
   base.isStringSelectMenu = () => true;
   return { interaction: base as unknown as AnySelectMenuInteraction, captured };
}

/** A fake modal submit; `fields` maps text-input customId → the value typed. */
export function fakeModalSubmit(customId: string, fields: Record<string, string> = {}, options: FakeInteractionOptions = {}): FakeInteraction<ModalSubmitInteraction> {
   const { base, captured } = buildBase(customId, options);
   base.fields = { getTextInputValue: (id: string) => fields[id] ?? '' };
   base.isModalSubmit = () => true;
   return { interaction: base as unknown as ModalSubmitInteraction, captured };
}

/** Routes a fake interaction to the right handler exactly like the real
 *  interactionCreate router (namespace = first `:` segment), so a flow test
 *  exercises routing too. Handlers can also be called directly if preferred. */
export async function routeComponent(client: ToscheClient, interaction: ComponentInteraction): Promise<void> {
   const namespace = interaction.customId.split(':')[0];
   const handler = client.componentHandlers.get(namespace);
   if (!handler)
      throw new Error(`no component handler registered for namespace '${namespace}'`);

   await handler.handle(client, interaction);
}

/** A minimal ToscheClient stand-in — a real lock manager (flows depend on it)
 *  plus whatever `overrides` a test needs (e.g. registered componentHandlers). */
export function fakeClient(overrides: Partial<ToscheClient> = {}): ToscheClient {
   return { locks: new CharacterLockManager(), ...overrides } as unknown as ToscheClient;
}
