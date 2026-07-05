# Economy — currencies, pricing, trade

See [README.md](README.md) for the legend. This is the smallest topic file today — almost
everything here is deliberately deferred (design intent: `RPG/Propositions.md`'s P17 called it
"later phase" from the start), so there isn't much built to describe yet.

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
  design docs: keep this last, add it once there's something worth spending coins on.
- **Time/encumbrance/survival as a deep-layer economy sink** *(P18)* — hooks (a Fatigued
  condition, Consitution vs disease) can stay in the design without building a full survival sim;
  must always stay auto-managed for casuals per README.md's pillar 6.
