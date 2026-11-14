# Economy — currencies, pricing, trade

See [README.md](README.md) for the legend. This is the smallest topic file today — almost
everything here is deliberately deferred (design intent: the original design docs' P17 called it
"later phase" from the start), so there isn't much built to describe yet.

---

> **What is built:** [implementation/economy.md](implementation/economy.md). This file holds only the rules.

## Reference (decided data & math)

**Currency** — one, `deltradaCoins`, per **character**, clamped `≥0` via `applyCurrencyDeltas`
(atomic delta). Regional per-race currencies (obsidian chips, amber drops, pearl flakes, silver,
gold) are **⬜ reserved** for the future exchange layer (D19).

### Formulas 🟡
```
buy price  (per piece) = max(1, round(value × quality multiplier × wear))
sell price (per piece) = max(1, floor(value × quality multiplier × wear × 0.5))   — 0 if unidentified
wear = durability left ÷ full durability   (1 for things that do not wear)
```
For a sale, `value` is the value of what the **seller believes** the item to be.

**Pricing** — an item's `value` 🪙 is its price at a merchant's stall; quality and wear scale
it. A merchant pays half. Later: a **Haggle** check (Charisma-rooted, skills.md) and **faction
reputation** (factions.md) move both prices.

**Shops** ✅ — a shop is a merchant NPC: its own pack is the stall, its own coins are the till.
First one: **Nazir, the Plaza Merchant** (plaza, morning and daytime).

| Each game day the stall starts with | 🟡 |
|---|---|
| Till | 250 coins |
| Food and drink | 6 Travel Rations, 4 Dried Carp, 3 Honeyed Mead |
| Healing | 4 Healer's Poultices |
| Weapons | Quarterstaff, Iron Dagger, Ash Spear, Woodsman's Axe, Iron Sword |
| Protection | Wooden Buckler, Leather Cap, Leather Gloves, Sturdy Boots, Leather Jerkin |

**Coin sources/sinks (designed, ⬜)** — sources: NPC/shop sales, quest rewards, arena wagers
(combat.md Duel), foraging/fishing/crafting output (professions.md). Sinks: buying gear/food,
land for gardening (professions.md), Stress treatment (flavor-progression.md), repairs.

**Units** — prices are numbers, not weights, so R19's metric/imperial split doesn't touch coin;
but any **weight/measure shown next to an item** (kg, cm) obeys the account units setting
(character.md R19): metric in DB, imperial computed on display.

---

## Ruleset

### One currency until there's an economy to spend it in ✅ D19
Rather than modeling all seven races' canon currencies (canid obsidian chips, tamian amber
drops, lutren pearl flakes, vulpin silver coins, felis gold…) up front with no exchange system
to give them meaning, the game ships with **one shared currency** and adds the regional ones
only once the trade/exchange layer that makes them *matter* actually exists. Parking six empty
wallets with nothing to spend them on is pure bookkeeping, not gameplay.

### Regional currencies & exchange ⬜ later phase *(was P17)*
Each race's own canon currency is a natural deep-layer system once it ships: regional value
(your amber is worth less in Aisling than in Sunsgrove), trade routes, and arena wagers
(combat.md's Duel mode) all hang off it. **Simple layer:** buy/sell at a default price, the bot
converts silently under the hood. **Deep layer:** haggle, exchange between regional
currencies, run trade routes. Scope for v1 vs later is still undecided.

### The first shop — a merchant is a character ✅ built (D60) / 🟡 every number
A shop is not a menu with infinite stock. It is an NPC with a pack and a purse, and trading
moves real goods and real coins between two characters. That is what makes a merchant feel
like someone: the stall can run out, the till can run dry, and what a player sells is on the
stall for the next player to buy.

- **Buying.** The stall shows what the merchant actually holds. A piece costs its value,
  scaled by quality and by wear. The buyer needs the coins and the room to carry it.
- **Selling.** The merchant pays half. Worn gear is worth less; equipped gear must be taken
  off first. The merchant can only pay what is in the till — when it is empty, the buying
  stops for the day, and selling to players goes on.
- **No profit in a round trip.** For any item the sell price is never above the buy price.
- **Unidentified finds do not sell.** Nobody pays for what neither side can name. That keeps
  the stall from becoming a free identification service: showing a find to the merchant
  tells the player nothing.
- **A mislabeled find sells by its label.** The merchant is taken in by the same lookalike
  as the player, pays the label's price, and only on the stall is the item what it truly
  is. So a wrong label is still a gamble — sometimes it pays more than the find was worth,
  sometimes less — and the offer never gives the truth away beforehand.
- **A new day, the same stall.** At the start of each game day the stall is reset: the same
  stock, the same coins. Yesterday's purchases from players have gone with the caravans,
  and so have yesterday's takings. The till is therefore the game's daily **coin source**
  (at most 250 a day into players' hands, server-wide) and what buyers pay is its **coin
  sink**.
- **Why a reset and not a simulation.** The daily reset is the merchant's whole "mind" for
  now. The goal (npcs.md) is NPCs that act on their own — restock from other NPCs, travel,
  run out for real. Trading already works on ordinary character data, so that behaviour can
  replace the reset later without touching how a trade works.

**Two layers** (pillar 6): the casual layer is this — open the stall, pick an item, press
Buy or Sell. Haggling, reputation prices and regional currencies are the deep layer, and all
of them will adjust the two prices above, not replace the stall.

---

## Open questions

- **Economy scope for v1** *(P17)* — what's worth building before the core loop (travel,
  encounters, skills, eventually combat) is proven fun. Recommendation carried over from the
  design docs: keep this last, add it once there's something worth spending coins on. The
  cheapest first slice was an **NPC merchant shop** (npcs.md) whose stock is the NPC's
  inventory — **built (D60)**. What follows it is still open.
- **Shop numbers** — the sell rate (half), the daily till (250) and the stock list are first
  guesses. With Spire rewards totalling 1,680 coins per character and foraged finds worth
  1–12 each, check after a week of play whether the till empties too early in the day.
- **Haggle × reputation coupling** — the price a character actually pays = base `value` ×
  faction-standing modifier (factions.md) × Haggle-check result (skills.md). Confirm the formula
  and how much standing/skill should swing price.
- **Time/encumbrance/survival as a deep-layer economy sink** *(P18)* — hooks (a Fatigued
  condition, Constitution vs disease) can stay in the design without building a full survival sim;
  must always stay auto-managed for casuals per README.md's pillar 6.

---

## Expansion ideas & risks

**Risks:**
- **This is the file everything else quietly depends on.** Professions (harvesting → sale),
  factions (haggle × reputation), NPCs (merchant stock), and items (bronze as a cost-gated tier)
  all assume *some* pricing/shop layer exists. Building any of those without at least the
  cheapest possible economy slice (a flat-price NPC shop, no haggle yet) risks each one
  improvising its own incompatible stand-in that has to be unwound later — see README's
  cross-cutting risk on self-driving-economy coupling.
- **A single shared currency simplifies balance but flattens racial flavor** (the canon per-race
  currencies are colorful and currently unused) — worth remembering this is a deliberate, revisit-
  able trade-off (D19), not a permanent decision, once trade/regional flavor is worth the
  bookkeeping.

**Expansion ideas:**
- **Quest-only currency or tokens** — before a full shop economy, the Imperator could hand out a
  quest-specific token redeemable for one thing (a title, a unique item) — a zero-infrastructure
  way to make deltradaCoins-adjacent rewards feel special without touching pricing/haggle at all.
- **A "black market" price modifier tied to reputation** — Hated/Hostile standing (factions.md)
  could still let a character buy, but only from disreputable sources at a steep markup — turns
  a bad reputation into an interesting cost rather than a hard wall, fitting the setting's
  morally-grey tone.
