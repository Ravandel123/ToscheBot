# Economy — implementation

What exists in `src/` today for the rules in [economy.md](../economy.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

### Currencies — `game/data/currencies.ts` ✅ per-character
One entry: **`deltradaCoins`** — starts at 0, clamped `>= 0` via
`characterService.applyCurrencyDeltas` (an atomic clamped delta, never read-modify-write).
Lives per **character**, not per account (character.md's Account↔Character split), like the
fight record. Earned today from Spire-ladder climbs (combat.md) and from selling.

### The shop ✅ / 🟡 numbers *(D60)*
- **`game/data/shops.ts`** — the catalog: which NPC keeps the shop (`npcId`), which hub
  action opens it, the greeting, `dailyCoins` and the daily `stock`. `shopAt(locationId)`
  finds the shop by the merchant's home location. `shops.test.ts` checks the keeper is a
  merchant, the action is live and offered there, and the stock leaves room on the stall.
- **`game/economy/trade.ts`** — the pure prices: `buyPrice`, `sellPrice` (`SELL_RATE` 0.5),
  `affordableQuantity`. `trade.test.ts` checks, over every item × quality × wear, that the
  sell price never exceeds the buy price.
- **`db/services/tradeService.ts`** — `buy`, `sell` and `openForTheDay`. The caller holds
  both characters' locks. Write order: buying moves the goods and then charges; selling pays
  and then moves the goods (undoing the payment if the stall is full) — so a crash between
  two writes can only favour the player.
- **`inventoryService.transferItem`** — moves units of one pack entry into another
  character's pack, insert before remove. Quality and wear travel; the identification veil
  does not (the goods arrive as what they are). `ignoreWeight` waives the carry limit for a
  stall; the 50-entry cap still applies ("the stall is piled high"). `setStock` replaces a
  pack with a stock list.
- **The daily reset** — `tradeService.openForTheDay(merchantId, shop, gameDay())` runs under
  the merchant's lock for the first visitor of each game day (`jobStateService.claimDay`,
  key `shop:<merchantId>`; `gameDay` in `game/world/time.ts` turns over at game midnight).
  There is no cron: a day nobody visits simply has no reset.
- **The panel** — hub action `market` (`play` executor → `_marketAction.openMarket`) repaints
  the hub message into the stall; the `market` component handles `tab` / `page` / `pick` /
  `do` (`_marketView.ts` builds the list and the item card). Every click re-resolves the
  stall from where the character stands: the shop, its opening hours and the merchant's
  presence. A trade follows the mutation pattern (fast-fail if locked → defer → both locks →
  fresh re-read → busy re-entry → act gate → trade → repaint).
- **Needs the merchant to exist** — the shop works only if `npm run seed-npcs` has created
  the NPC characters; without Nazir the stall reports that its keeper is nowhere to be seen.

### What isn't built
- Haggling, reputation prices, player-to-player trade.
- The regional per-race currency catalog and any exchange-rate logic.
- Quest rewards, arena wagers, repairs.
- A second shop (the catalog allows one per location).
