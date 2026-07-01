import { ClientEvents } from 'discord.js';
import type { ToscheClient } from '../client.js';

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
   name: K;
   once?: boolean;
   execute(client: ToscheClient, ...args: ClientEvents[K]): Promise<void> | void;
}

// Identity helper so event files get full inference of `args` from `name`
// without spelling out the generic.
export function defineEvent<K extends keyof ClientEvents>(event: BotEvent<K>): BotEvent<K> {
   return event;
}
