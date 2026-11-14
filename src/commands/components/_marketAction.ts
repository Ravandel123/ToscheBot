// Discord adapter (marked): the EXECUTION side of a merchant's stall (D60) —
// opening it from the `/play` hub and carrying out one trade. A trade is a
// short action (D5 rule 1): both characters locked, everything re-read inside
// the lock, the trade service does the writes, the panel is repainted. The
// views live in `_marketView.ts`; the trade rules in game/economy/trade.ts and
// db/services/tradeService.ts.
import type { MessageComponentInteraction } from 'discord.js';
import { activitySessionService } from '../../db/services/activitySessionService.js';
import { characterService } from '../../db/services/characterService.js';
import { locationStateService } from '../../db/services/locationStateService.js';
import { tradeService, type TradeFailure, type TradeResult } from '../../db/services/tradeService.js';
import { canCharacterAct, type ActBlockReason } from '../../game/character/rules.js';
import { displayName } from '../../game/character/identity.js';
import { hubAction } from '../../game/data/hubActions.js';
import { resolveLocationId } from '../../game/data/locations.js';
import { shopAt, type LocatedShop } from '../../game/data/shops.js';
import { evaluateCondition, worldContext } from '../../game/world/conditions.js';
import { gameDay } from '../../game/world/time.js';
import { busyNote } from './_activities/registry.js';
import { freshHubView } from './_hubView.js';
import { buildMarketList, type MarketMode } from './_marketView.js';
import { sessionStepView } from './_playPanel.js';
import type { CharacterDoc } from '../../db/models/character.js';
import type { ToscheClient } from '../../client.js';

const TRADE_BLOCK_MESSAGE: Record<ActBlockReason, string> = {
   'not-approved': 'Merchants deal only with those the Imperator has recognized. Finish your character with `/character create`.',
   'incapacitated': 'You are in no state to haggle — recover first.',
   'no-action-points': 'You lack the Action Points to trade.', // unreachable at cost 0; keys must be total
};

export type Stall =
   | { ok: true; located: LocatedShop; merchant: CharacterDoc }
   | { ok: false; reason: string };

/**
 * The stall a character can trade at RIGHT NOW, re-resolved from where they
 * stand — never from the panel they clicked (a market panel can outlive a
 * move, a nightfall or the merchant's departure). Read-only.
 */
export async function stallFor(character: CharacterDoc): Promise<Stall> {
   const locationId = resolveLocationId(character.locationId);
   const located = shopAt(locationId);
   if (!located)
      return { ok: false, reason: 'There is no stall where you now stand.' };

   const state = await locationStateService.getFresh(locationId);
   const open = evaluateCondition(hubAction(located.shop.hubActionId)?.availability, worldContext(state, character));
   if (!open.ok)
      return { ok: false, reason: `🔒 The stall is shut — ${open.reason}.` };

   const merchant = await characterService.get(located.merchantId);
   if (merchant?.locationId !== locationId)
      return { ok: false, reason: 'The stall stands empty — its keeper is nowhere to be seen.' };

   return { ok: true, located, merchant };
}

/**
 * Opens the stall on the hub message. The `interaction` must already be
 * acknowledged with `deferUpdate()`. The day's first visitor triggers the
 * merchant's daily routine (stock laid out, till refilled) under the
 * merchant's lock; after that this is a pure read.
 */
export async function openMarket(client: ToscheClient, interaction: MessageComponentInteraction, character: CharacterDoc): Promise<void> {
   const session = await activitySessionService.getActiveForParticipant(character._id);
   const step = session ? sessionStepView(session, busyNote(session)) : null;
   if (step) {
      await interaction.editReply(step);
      return;
   }

   const act = canCharacterAct(character, 0);
   if (!act.ok) {
      await interaction.editReply(await freshHubView(character, TRADE_BLOCK_MESSAGE[act.reason]));
      return;
   }

   const stall = await stallFor(character);
   if (!stall.ok) {
      await interaction.editReply(await freshHubView(character, stall.reason));
      return;
   }

   const { shop, merchantId } = stall.located;
   const restocked = await client.locks.runExclusive([merchantId], () => tradeService.openForTheDay(merchantId, shop, gameDay()));
   const merchant = restocked ? await characterService.get(merchantId) ?? stall.merchant : stall.merchant;

   await interaction.editReply(buildMarketList(shop, character, merchant, 'buy'));
}

/**
 * Carries out one trade and repaints the list. The `interaction` must already
 * be acknowledged with `deferUpdate()`. Everything is validated again inside
 * the lock, from fresh documents.
 */
export async function performTrade(
   client: ToscheClient,
   interaction: MessageComponentInteraction,
   character: CharacterDoc,
   mode: MarketMode,
   page: number,
   instanceId: string,
   quantity: number,
): Promise<void> {
   const located = shopAt(resolveLocationId(character.locationId));
   if (!located) {
      await interaction.editReply(await freshHubView(character, 'There is no stall where you now stand.'));
      return;
   }

   await client.locks.runExclusive([character._id, located.merchantId], async () => {
      const fresh = await characterService.get(character._id);
      if (!fresh) {
         await interaction.editReply({ content: 'Your character vanished mid-bargain. Try again.', embeds: [], components: [] });
         return;
      }

      const session = await activitySessionService.getActiveForParticipant(fresh._id);
      const step = session ? sessionStepView(session, busyNote(session)) : null;
      if (step) {
         await interaction.editReply(step);
         return;
      }

      const act = canCharacterAct(fresh, 0);
      if (!act.ok) {
         await interaction.editReply(await freshHubView(fresh, TRADE_BLOCK_MESSAGE[act.reason]));
         return;
      }

      const stall = await stallFor(fresh);
      if (!stall.ok) {
         await interaction.editReply(await freshHubView(fresh, stall.reason));
         return;
      }

      const { shop, merchantId } = stall.located;

      // A trade click can be the day's first: lay the stall out before it. The
      // clicked entry is then gone, and the trade below reports exactly that.
      await tradeService.openForTheDay(merchantId, shop, gameDay());

      const result = mode === 'buy'
         ? await tradeService.buy(fresh._id, merchantId, instanceId, quantity)
         : await tradeService.sell(fresh._id, merchantId, instanceId, quantity);

      const [after, merchant] = await Promise.all([characterService.get(fresh._id), characterService.get(merchantId)]);
      await interaction.editReply(buildMarketList(shop, after ?? fresh, merchant ?? stall.merchant, mode, page, tradeNote(mode, result, stall.merchant)));
   });
}

const TRADE_FAILURE: Record<TradeFailure, (merchantName: string) => string> = {
   'not-found': () => '⚠️ That is no longer there — the stall has changed since you looked.',
   'equipped': () => '⚠️ You are wearing that. Take it off first.',
   'worthless': () => '⚠️ Nobody pays for what cannot be named. Examine it first.',
   'cannot-afford': () => '⚠️ Your purse is too light for that.',
   'merchant-broke': (merchantName) => `⚠️ ${merchantName} spreads empty hands — the till is dry for today.`,
   'inventory-full': () => '⚠️ Your pack has no room for another thing.',
   'too-heavy': () => '⚠️ You could not carry that as well.',
   'stall-full': () => '⚠️ The stall is piled high already — come back tomorrow.',
};

function tradeNote(mode: MarketMode, result: TradeResult, merchant: CharacterDoc): string {
   if (!result.ok)
      return TRADE_FAILURE[result.reason](displayName(merchant));

   const goods = result.quantity > 1 ? `${result.quantity}× ${result.name}` : result.name;
   return mode === 'buy'
      ? `🛒 You buy **${goods}** for **${result.total}** 🪙.`
      : `💰 You sell **${goods}** for **${result.total}** 🪙.`;
}
