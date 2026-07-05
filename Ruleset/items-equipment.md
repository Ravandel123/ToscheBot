# Items & Equipment — gear, the carried pack, the stash

See [README.md](README.md) for the legend.

---

## Ruleset

### Gear as a real choice, WHFRP not D&D ✅ direction *(was P16)*
Gear should matter a lot in gritty combat (combat.md), because Soak blunts every hit — a
weapon's damage tags and an armour's Armour Value are meant to be a real decision, not a
rounding error. Weapons carry a base Damage and tags (Fast, Reach, Two-handed, Thrown,
Finesse…); armour gives an **Armour Value (AV)** — one global value in the simple layer,
per-body-location in the deep layer, more AV meaning more Soak but a heavier
Agility/encumbrance cost. **Bronze** (the polcan `Bronzeforged` niche — canon's only bronze
smiths) should sit **one quality tier above** common bone/leather gear, gated by rarity and
cost rather than being simply free to polcan — an edge, not an auto-pick.

**Casual layer:** auto-equip the best owned kit for your role. **Deep layer:** per-slot
loadout, weapon tags, encumbrance, quality/condition. (Neither the auto-equip button nor Roles
exist yet — see skills.md.)

### Quality is per instance ✅ built, tie to skills.md is ⬜
Two different items forged from the same catalog blueprint can differ in **craftsmanship
quality** — poor through masterwork. Skills.md's Smithing example describes where this is
*meant* to come from: a check's surplus over an item's required sum. Today quality is instead
a flat tag chosen at acquisition (Implementation, below) — the quality-from-a-check pipeline
isn't wired up.

### Two-tier storage: what's carried vs what's owned ✅ built D33
A character's **carried pack** (what's on them, what can be equipped) is a different thing
from **everything else they own** (a home chest, eventually a bank) — a hoard can grow to
thousands of items over a long-lived character, so it must not live in the same place as the
gear that's read on every single check. Equipping should only ever be possible from the
carried pack — you withdraw from storage into the pack, then equip; equipping directly out of
storage is deliberately not offered, so "what's equipped" never depends on anything other than
the pack.

---

## Implementation

### Items — `game/data/items.ts` ✅ shape / 🟡 every number
A discriminated union by `kind` (adding a kind = one union member + one `ITEM_KINDS` meta
entry — the `/inventory` panel renders categories from the meta):

| kind | stackable | key fields |
|---|---|---|
| `weapon` | no | `damage {min,max}` 🟡, `reach`, `hands` (1/2), WHFRP-style `properties` (piercing, entangling, fast, slow, impact, defensive, hack, pummel, precise), `durabilityMax`, `slots` |
| `shield` | no | `armor` (AV) 🟡, `durabilityMax`, `slots` |
| `armor` | no | `armor` (AV) 🟡, `durabilityMax`, `slots` (head/chest/hands/legs/feet) |
| `consumable` | yes | `effects` — resource deltas applied on use (rations +5 stamina, poultice +5 health) |
| `material` | yes | crafting stock (iron ingot, oak timber…) — no consumer yet, crafting isn't built |
| `clutter` | yes | flavor junk (bent spoon, mysterious sock) |

Any equippable may carry `attributeRequirements` (checked against **base** attributes, so
equip order can never matter — e.g. STR 40 to wield a war maul) and `attributeModifiers`
(a steel breastplate: Agility −10, Dexterity −5 — same shape as racial modifiers,
character.md). Common fields: `name`, in-character `description`, `material` (→ a small
`MATERIALS` catalog; bronze is deliberately pricey, per the polcan monopoly), `weightKg`,
`value` 🪙 (display-only until economy.md's pricing layer exists).

**Craftsmanship quality is per-instance**, not per-catalog-entry: `ITEM_QUALITIES` (poor →
common → fine → masterwork) — any catalog entry can drop at any tier. 🟡 Quality today only
scales the durability max and value (a name-prefix like "Battered"/"Fine"/"Masterwork"); it
does **not** affect damage or armour value (that interplay waits on skills.md's crafting model).
~30 items ship as a starter catalog; ids are append-only (never renamed/removed once a
character can reference one) and test-validated (legal slots, ordered damage ranges, positive
weights, two-handed ⇒ main-hand-only, non-zero effects/modifiers).

### Equipment slots — `game/data/equipmentSlots.ts` ✅
`mainHand, offHand, head, chest, hands, legs, feet`. A character's `equipment` field is a plain
object keyed by these ids — adding a slot (cloak, trinket, ammo…) is one catalog entry, no
migration. Weapons declare which slots fit (a dagger fits either hand → the panel offers a
choice); a two-handed weapon occupies `mainHand` and **freezes `offHand`** (equipping it vacates
the off hand, and the off hand refuses new gear while it's wielded).

### The carried pack — `Character.inventory[]` ✅ shape / 🟡 numbers D28
Embedded on the character (bounded + read on every check, per root `CLAUDE.md`'s D32
persistence rule): `{ instanceId (8-char, rides in customIds), itemId → catalog, quality,
quantity (stackable kinds), durability?, acquiredAt }`, capped at
`INVENTORY_STACK_LIMIT = 50` entries. **Carry capacity** = Strength in kg (🟡); going over
blocks further acquisition only — there's no movement penalty yet.

### The stash — `db/models/item.ts` + `itemService` ✅ built D33
Owned-but-not-carried items (a home chest, eventually a bank — unbounded, potentially
thousands) live in a **separate `Item` collection**, one document per instance/stack (never
one doc per character, which would just rebuild the same giant-array problem):

| Field | Notes |
|---|---|
| `_id` | a fresh uuid (global doc identity — see the divergence note below) |
| `ownerId` | → `Character._id`; indexed with `container` |
| `container` | `home_chest` \| … (→ `game/data/containers.ts`) |
| `instanceId` | 8-char handle, unique **within the owner's stash**, rides in customIds |
| `itemId`, `quality`, `quantity`, `durability?`, `acquiredAt` | mirror the pack's instance fields |

**Why `_id` isn't literally the pack's `instanceId`:** the pack's 8-char handle is only unique
*within one character's pack*, so reused as a global `_id` two characters could collide and
silently clobber each other's item; a full uuid instead avoids that at the cost of a second,
shorter `instanceId` re-minted unique per stash for customIds. Indexed `{ownerId, container}`;
`/stash` browses it **server-side paginated + aggregated** (a normal character read never
touches this collection) reusing the `/inventory` panel's renderers. **Deposit** = the 🗄️
Store button on an `/inventory` item card (whole entry → the container, vacating any slot it
occupied). **Withdraw** re-checks the pack's cap + carry capacity and lands as a fresh pack
entry (no auto-merge, to keep the transfer idempotent). Transfers run under the character's
lock and, since cross-collection writes aren't transactional, **insert the destination copy
before removing the source** — a crash mid-transfer leaves a recoverable duplicate, never a
lost item.

### Storage containers — `game/data/containers.ts` ✅
Where stashed items live: one entry ships, `home_chest` (`{name, emoji, description}`).
`DEFAULT_CONTAINER = home_chest` is what the 🗄️ Store button targets. Adding a container (a
bank, saddlebags…) is one catalog entry; ids are append-only and stored on `Item` docs. **Not
location-gated yet** — every container is reachable from `/stash` regardless of where the
character is; tying a container to a place is a future step (world-travel.md's per-location
activity idea).

### Equip rules — `game/character/inventory.ts → planEquip` ✅ pure logic
Legal slot → requirements checked against **base** attributes → broken gear refused → a
two-handed weapon vacates and blocks the off hand while wielded → equipping into an occupied
slot displaces the occupant back into the pack → moving an equipped item frees its old slot.
Applied atomically, filter-guarded on the instance still existing. **Effective attributes**
(consumed by combat.md's future combat stats and today's travel-challenge check targets,
combat.md) = stored attributes + Σ equipped `attributeModifiers`, floored at 1.

### Concurrency & acquisition ✅
Every inventory mutation (equip/use/drop/store/withdraw) runs under the character's lock with a
fresh re-read, and is refused outright while the character is **busy** (in-memory locked or in
an active `ActivitySession`) — gear is frozen mid-adventure so a travel challenge's stored check
targets stay honest. A double-click across two open panels resolves to a typed "no longer in
your pack" note, never a double-spend. `/item grant` (owner-only) is the **only** loot source
today — no fishing/shop/loot-table has been built.

### What isn't built
- Loot sources beyond `/item grant` (fishing, shops, loot tables, a starting-kit wizard step).
- A second/location-gated storage container (a bank; today only `home_chest`) and a
  withdraw+equip convenience wrapper.
- Durability damage + repair; partial-stack transfers/drops; ground piles; player-to-player
  trading; ranged weapons + ammunition.
- Auto-equip-best (the intended simple-layer default).
- Quality-from-a-check (skills.md's crafting model) and quality×damage interplay.
- Selling / pricing beyond a flat display-only `value` (economy.md).

---

## Open questions

- **Encumbrance consequences** — today over-capacity only blocks acquisition; no
  movement/Agility penalty. Worth adding once travel/combat have a reason to care.
- **Armour/bronze weight** *(P16)* — confirm v1 = one global AV per set; bronze as a cost-gated
  tier above common gear, not a free polcan perk.
- **Item checks as challenge approaches** *(P-challenges, world-travel.md)* — a rope trivializing
  the fallen-tree climb is the model's own worked example, but items don't hook into travel
  encounters yet.
- **Where loot actually comes from** once `/item grant` stops being the only source.
