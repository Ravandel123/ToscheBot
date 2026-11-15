// What a narrated bout in the Spire channel shares, duel or ladder: the paced
// telling of the blows, the no-ping channel line, and the guard against two
// near-simultaneous clicks starting the same fight twice. Underscore prefix →
// loader skips it.
import type { SendableChannels } from 'discord.js';
import { sleep } from '../../lib/async.js';
import { buildStyleIntro, renderBlow } from './_duelView.js';
import type { DuelResult } from '../../game/combat/duel.js';

const INTRO_DELAY_MS = 1500;
const ROUND_DELAY_MS = 1200;

/** A channel line that never pings anyone (chronicle-style). */
export async function announce(channel: SendableChannels, content: string): Promise<void> {
   await channel.send({ content, allowedMentions: { parse: [] } });
}

/** The opening line, then — paced — the fighters' opening styles and every
 *  blow. The caller announces the ending; the outcome is saved before this runs. */
export async function narrateBout(channel: SendableChannels, opening: string, result: DuelResult, names: Record<string, string>): Promise<void> {
   await announce(channel, opening);
   await sleep(INTRO_DELAY_MS);

   const styleIntro = buildStyleIntro(result.openingStyles, names);
   if (styleIntro) {
      await announce(channel, styleIntro);
      await sleep(ROUND_DELAY_MS);
   }

   for (const blow of result.blows) {
      await announce(channel, renderBlow(blow, names));
      await sleep(ROUND_DELAY_MS);
   }
}

/**
 * First click wins, per message. Two clicks on the same card are separate
 * interactions that can both pass the lock check before either takes the
 * lock; `claim` is synchronous, so exactly one of them gets through. In
 * memory is enough — there is one bot process.
 */
export class MessageClaims {
   private readonly held = new Set<string>();

   has(messageId: string): boolean {
      return this.held.has(messageId);
   }

   /** True for the first caller; false while the message is already claimed. */
   claim(messageId: string): boolean {
      if (this.held.has(messageId))
         return false;

      this.held.add(messageId);
      return true;
   }

   release(messageId: string): void {
      this.held.delete(messageId);
   }
}
