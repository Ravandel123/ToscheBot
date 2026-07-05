# Economy — currencies, pricing, trade

See [README.md](README.md) for the legend. This is the smallest topic file today — almost
everything here is deliberately deferred (design intent: the original design docs' P17 called it
"later phase" from the start), so there isn't much built to describe yet.

---

## Reference (decided data & math)

**Currency** — one, `deltradaCoins`, per **character**, clamped `≥0` via `applyCurrencyDeltas`
(atomic delta). Regional per-race currencies (obsidian chips, amber drops, pearl flakes, silver,
gold) are **⬜ reserved** for the future exchange layer (D19).

**Pricing** — item `value` 🪙 is **display-only** today. Future: **Haggle** check
(Charisma-rooted, skills.md) modified by **faction reputation** (factions.md) sets the real price.

**First shops** — an NPC merchant's `inventory` *is* the shop stock, restocked by the NPC CRON
(npcs.md); trading with it is the first real coin **source and sink**.

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

### Pricing today ⬜
Item `value` (items-equipment.md) is currently **display-only** — nothing lets a player buy,
sell, or haggle yet. A skill-driven Haggle check (charisma-rooted, skills.md) is the intended
mechanism once buying/selling exists, rather than a fixed price for everyone.

---

## Implementation

### Currencies — `game/data/currencies.ts` ✅ per-character
One entry: **`deltradaCoins`** — starts at 0, clamped `>= 0` via
`characterService.applyCurrencyDeltas` (an atomic clamped delta, never read-modify-write).
Lives per **character**, not per account (character.md's Account↔Character split), matching
Smackdown ELO.

### What isn't built
- Any way to earn or spend `deltradaCoins` in play — no shop, no quest reward path, no wager.
- The regional per-race currency catalog and any exchange-rate logic.
- Haggle as a skill check affecting price.
- Selling items, buying items, trade routes, arena wagers.

---

## Open questions

- **Economy scope for v1** *(P17)* — what's worth building before the core loop (travel,
  encounters, skills, eventually combat) is proven fun. Recommendation carried over from the
  design docs: keep this last, add it once there's something worth spending coins on. The
  cheapest first slice is an **NPC merchant shop** (npcs.md) whose stock is the NPC's inventory —
  it turns professions output (professions.md) into coin and coin into gear in one build.
- **Haggle × reputation coupling** — the price a character actually pays = base `value` ×
  faction-standing modifier (factions.md) × Haggle-check result (skills.md). Confirm the formula
  and how much standing/skill should swing price.
- **Time/encumbrance/survival as a deep-layer economy sink** *(P18)* — hooks (a Fatigued
  condition, Consitution vs disease) can stay in the design without building a full survival sim;
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
