import type { ComponentHandler } from '../../types/interactions.js';
import { accountService } from '../../db/services/accountService.js';
import { performTrade, stallFor } from './_marketAction.js';
import { freshHubView } from './_hubView.js';
import { buildMarketList, buildTradeCard, marketItem, type MarketMode } from './_marketView.js';
import { ephemeral } from '../../lib/discord.js';
import { NO_ACTIVE_CHARACTER } from './_characterAction.js';

// Handles a merchant's stall (namespace `market`). The stall lives on the
// player's own ephemeral hub message, so the clicker is always the
// active-character owner. Nothing in a customId is trusted beyond "which entry
// did they point at": the stall, its opening hours and the merchant's presence
// are re-resolved from where the character stands at every click.
//   tab:<mode>:<page>, page:<mode>:<page> → the list (read-only);
//   pick:<mode>:<page>  (select)         → one item's trade card (read-only);
//   do:<mode>:<page>:<instanceId>:<qty>  → the trade — a mutation: fast-fail if
//     locked → deferUpdate → both locks → fresh re-read → trade → repaint.

export default {
   namespace: 'market',
   async handle(client, interaction) {
      if (!interaction.isButton() && !interaction.isStringSelectMenu())
         return;

      const [, action, modeRaw, pageRaw, instanceId = '', quantityRaw = '1'] = interaction.customId.split(':');
      const mode: MarketMode = modeRaw === 'sell' ? 'sell' : 'buy';
      const page = Math.max(0, Number(pageRaw) || 0);

      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.reply({ content: NO_ACTIVE_CHARACTER, ...ephemeral });
         return;
      }

      if (action === 'do' && interaction.isButton()) {
         if (client.locks.isLocked(character._id)) {
            await interaction.reply({ content: 'Your character is busy right now — try again in a moment.', ...ephemeral });
            return;
         }

         const quantity = quantityRaw === 'all' ? Number.MAX_SAFE_INTEGER : Math.max(1, Number(quantityRaw) || 1);
         await interaction.deferUpdate();
         await performTrade(client, interaction, character, mode, page, instanceId, quantity);
         return;
      }

      // Read-only from here: no lock, staleness self-heals on the next repaint.
      const stall = await stallFor(character);
      if (!stall.ok) {
         await interaction.update(await freshHubView(character, stall.reason));
         return;
      }

      const { shop } = stall.located;

      if (action === 'pick' && interaction.isStringSelectMenu()) {
         const item = marketItem(mode, character, stall.merchant, interaction.values[0] ?? '');
         await interaction.update(item
            ? buildTradeCard(character, stall.merchant, mode, page, item)
            : buildMarketList(shop, character, stall.merchant, mode, page, '⚠️ That is no longer there — the stall has changed since you looked.'));
         return;
      }

      await interaction.update(buildMarketList(shop, character, stall.merchant, mode, page));
   },
} satisfies ComponentHandler;
