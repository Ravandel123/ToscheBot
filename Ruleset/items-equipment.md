# Items & Equipment — gear, the carried pack, the stash

See [README.md](README.md) for the legend.

---

## Reference (decided data & math)

**Item kinds** (`game/data/items.ts`, discriminated union): `weapon` · `shield` · `armor` ·
`consumable` · `material` · `clutter`. Stackable: consumable/material/clutter.

**Equipment slots** (`equipmentSlots.ts`): `mainHand, offHand, head, chest, hands, legs, feet`.
Two-handed weapon occupies mainHand **and** freezes offHand.

**Quality tiers** — a **universal 5-rung numeric scale** (`QUALITY_TIER = 0..4`, 🟡 count),
shared by every item kind for math (value/durability multiplier, and later crafting-quality-
from-a-check, skills.md). The **display name** for a tier is resolved per **item family**, not
globally — `crude/common/fine/superior/masterwork` fits a sword, but is nonsense on a fish or a
mushroom (R23; see Ruleset below). Today's `ITEM_QUALITIES = poor · common · fine · masterwork`
(4, gear-only naming) is the tier-0..3 predecessor of this. 🟡 quality scales durability + value
only (damage/AV interplay waits on skills.md crafting).

**Carried pack** — `Character.inventory[]` embedded, cap `INVENTORY_STACK_LIMIT = 50`; carry
capacity = **Strength in kg** (🟡). Instance = `{instanceId(8ch), itemId, quality, quantity?,
durability?, acquiredAt}` + the optional **identification veil** (R16, ✅ S1):
`identified?/apparentItemId?/descriptorId?` — absent = identified (zero migration); mysteries
never stack; the veil survives pack↔stash transfers; display renders the owner's BELIEF
(descriptor / apparent item), weight always the truth.

**Stash** (`db/models/item.ts`, D33) — separate `Item` collection for owned-but-uncarried
(unbounded); `_id`=uuid, `instanceId` short handle, indexed `{ownerId, container}`. Equip is
**pack-only** (withdraw → then equip).

**Material composition (R-materials, ⬜)** — an item = a **hardcoded base blueprint** + its
**material(s)**; the material modifies final **weight / durability / AV or damage / properties**,
snapshotted onto the instance at creation (D10 rule-4 snapshot). Bronze sits one quality tier
above common bone/leather, cost/rarity-gated (polcan `Bronzeforged`).

**Effective attributes** = stored attributes + Σ equipped `attributeModifiers`, floored at 1 →
feeds combat.md checks + `/character view`. Requirements checked vs **base** attributes.

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

### Quality is per instance ✅ built, tie to skills.md is 🟨 half-wired
Two different items forged from the same catalog blueprint can differ in **craftsmanship
quality** — poor through masterwork. Skills.md's Smithing example describes where this is
*meant* to come from: a check's surplus. **Gathering does this since S1**: foraged instances
get their tier from `qualityFromCheck` (professions.md — the shared surplus→quality helper,
SL-driven, sim-tuned so the top tier stays rare). Crafting's required-sum variant is still ⬜;
`/item grant` still hands out flat tags.

### Two-tier storage: what's carried vs what's owned ✅ built D33
A character's **carried pack** (what's on them, what can be equipped) is a different thing
from **everything else they own** (a home chest, eventually a bank) — a hoard can grow to
thousands of items over a long-lived character, so it must not live in the same place as the
gear that's read on every single check. Equipping should only ever be possible from the
carried pack — you withdraw from storage into the pack, then equip; equipping directly out of
storage is deliberately not offered, so "what's equipped" never depends on anything other than
the pack.

### Quality — a universal tier NUMBER, a per-category NAME ✅ direction R23 *(owner-requested, refined)*
The owner's question: quality should be **universal**, but how many tiers (3–10)? And a follow-
up he flagged himself while reviewing: a single global name ladder breaks down across item
kinds — **"Masterwork Fish" or "Superior Mushroom" reads as nonsense**, even though a fish and a
mushroom absolutely *should* have quality variance (a prize catch, a pristine specimen). The fix
is to **split the concept in two**:
- **One shared numeric tier, universal.** `QUALITY_TIER = 0..4` (**5 rungs** — recommendation,
  down from the owner's 3–10 range): enough variety without diluting adjacent tiers into noise on
  a friends-server's loot volume, and it maps 1:1 onto skills.md's crafting **quality-from-
  surplus** bands, so *every* item family (weapon, meal, catch, forage) uses the exact same 0–4
  number for math — value multiplier, durability, and (once built) a check's quality outcome.
  This number is what the engine reasons about; it's never shown to the player directly.
- **A display name resolved per item family, not globally.** Each item **category** (weapon/
  armor, food/meal, fish, forageable, clutter…) owns its **own 5-word name ladder** mapped onto
  the same 0–4 scale — so tier 4 reads **"Masterwork"** on a sword, **"Prize Catch"** on a fish,
  **"Pristine"** on a foraged herb (professions.md), **"Exquisite"** on a cooked dish
  (professions.md's flavor engine), and something equally sensible on whatever category comes
  next. Adding a category = one more 5-name array in the catalog (`QUALITY_NAMES: Record<ItemFamily,
  [string,string,string,string,string]>`), not a new tier system. Today's `ITEM_QUALITIES = poor
  · common · fine · masterwork` (4, gear-only) is the direct predecessor — it becomes the
  `weapon/armor/shield` family's name row on the new 5-tier scale.
- Quality stays **per instance** (two swords from one blueprint differ) and, once crafting/
  professions exist, comes from a **check** (skills.md's surplus bands), not a flat acquisition
  tag. 🟡 Quality currently scales durability + value only; interplay with damage/AV waits on the
  crafting model, and the per-family name tables don't exist in code yet (only the gear one does).

### Items are a base blueprint + material(s), composed dynamically ✅ direction (⬜ built) *(owner-requested)*
The owner: "it should be made out of specific material(s)… affecting its weight, durability,
armor/damage, special traits… there should be a hardcoded base of an item, but the item is
created more dynamically." Decision, and it's the same shape as cooking's dynamic meals
(professions.md) and smithing's summed check (skills.md):
- **The blueprint is hardcoded** (D10): a *sword* base defines shape, slots, base damage band,
  base weight, which properties are possible.
- **The material parameterizes it.** A **material** (`MATERIALS` catalog) carries multipliers/
  deltas: density (→ weight), hardness/toughness (→ durability, AV/damage), and granted or
  forbidden **properties** (a bronze edge holds less than steel; bone is light but brittle;
  ironwood hafts differently). "Iron longsword" vs "bronze longsword" vs "bone longsword" are the
  *same blueprint*, different final stats.
- **The instance snapshots the result.** Because the final numbers depend on blueprint × material
  (× quality × craftsman skill), the created instance stores a **snapshot** of its computed stats
  (D10 rule-4's explicit snapshot exception), not just `itemId`+`materialId` — so a later catalog
  rebalance can't silently mutate an item a player already owns, and reading the item is one field
  access, not a recompute. The DB handling the owner worried about ("may be tricky") is exactly
  this: **store the composed result on the instance**, resolve display/flavor from the base
  blueprint. This is *the* mechanism that makes crafting (skills.md), materials (metallurgy tree),
  and the polcan **Bronzeforged** niche mean something.
- **Casual vs deep:** a casual sees "Fine Steel Longsword" and its final numbers; a deep crafter
  chooses the material to tune weight vs durability vs damage-type for the armour they expect to
  face (the armour ✕ weapon-type read, combat.md).

### Equipped items surfaced in the equip dropdowns ✅ direction (⬜ built) *(owner-requested, small)*
A UX fix the owner asked for: when the `/inventory` panel offers a **dropdown to equip** into a
slot (or pick which hand), the currently-equipped item for that slot should be **shown in the
list** (marked "equipped", e.g. a ✅/📌), not hidden — so the player sees what they'd be replacing
and can select it to unequip in place. Purely a renderer change to the equip select (the data is
already in `equipment`); no model change.

---

## Implementation

### Items — `game/data/items.ts` (facade over `game/data/items/`, D50) ✅ shape / 🟡 every number

Since 2026-07-12 the catalog is a folder: `items/types.ts` holds the type system (kinds,
qualities, materials, weapon properties/reach, the definition union); one file per kind
(`weapons.ts`, `shields.ts`, `armor.ts`, `consumables.ts`, `craftingMaterials.ts`,
`clutter.ts`) holds the entries; `items.ts` re-exports everything and assembles `ITEMS`
(foraged materials still spread in from `foragables.ts`, D43). **Adding an item = one entry
in its kind's file**; consumers keep importing `./items.js`.
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
- ~~Loot sources beyond `/item grant`~~ — **foraging is the first real source (S1)**; still
  missing: fishing (S2), shops (npcs.md/economy.md), loot tables, a starting-kit wizard step.
- A second/location-gated storage container (a bank; today only `home_chest`) and a
  withdraw+equip convenience wrapper.
- Durability damage + repair; partial-stack transfers/drops; ground piles; player-to-player
  trading; ranged weapons + ammunition.
- Auto-equip-best (the intended simple-layer default).
- **Dynamic material composition** — `material` is flavor + weight today; the
  blueprint × material → computed weight/durability/AV/damage/properties **snapshot** is designed
  (above) but not wired.
- **The 5-tier quality expansion + full per-family name tables** (R23) — still on the 4-tier
  scale, but the FIRST per-family name row exists (S1): foragables read
  Wilted/—/Choice/Pristine (`FORAGE_QUALITY_PREFIXES`), gear keeps `ITEM_QUALITIES` prefixes.
  Crafting quality-from-a-check + quality×damage interplay still ⬜.
- **Equipped item shown in the equip dropdown** (the small owner-requested renderer fix).
- **Per-location AV** and the **armour ✕ weapon-type multiplier** (combat.md R12) — armour is one
  global AV today.
- Selling / pricing beyond a flat display-only `value` (economy.md).

---

## Open questions

- **Quality tier count & per-family names** *(R23)* — the *split* (universal 0–4 number, per-
  family display name) is decided; confirm the tier count itself (recommendation **5**) and
  author the actual name row for each item family beyond weapon/armor (food, fish, forageables,
  clutter — professions.md needs these first) plus each tier's concrete numeric effect once
  crafting derives quality from a check.
- **Material-composition math** *(owner)* — the exact material multipliers/deltas per stat
  (density→weight, hardness→durability/edge, granted/forbidden properties), how quality and
  craftsman skill fold in, and the composed-instance snapshot shape.
- **Encumbrance consequences** — today over-capacity only blocks acquisition; no
  movement/Agility penalty. Worth adding once travel/combat have a reason to care (moveSpeed,
  character.md R20, is the first consumer).
- **Armour/bronze weight** *(P16)* — confirm v1 = one global AV per set; bronze as a cost-gated
  tier above common gear, not a free polcan perk.
- **Item checks as challenge approaches** *(P-challenges, world-travel.md)* — a rope trivializing
  the fallen-tree climb is the model's own worked example, but items don't hook into travel
  encounters yet.
- **Where loot actually comes from** once `/item grant` stops being the only source.

---

## Expansion ideas & risks

**Risks:**
- **Blueprint × material × quality is now three orthogonal axes per item.** Combined with the
  R23 per-family quality names, authoring/testing every item family's full combination space
  grows fast. Risk: without strong per-material flavor differentiation, "every sword ever" ends
  up numerically similar with different names — the exact stat-soup outcome the WHFRP-not-D&D
  direction (this file's opening Ruleset section) is trying to avoid. Mitigation: make materials
  differ on **properties**, not just magnitude (bronze doesn't just have "slightly worse AV" than
  steel — it should hold an edge differently, weigh differently, resist different damage types),
  so the choice is a genuine trade-off, not a strictly-better/worse ladder.
- **Per-family quality name tables are easy to forget when adding a new item family.** Since
  quality display now depends on a lookup keyed by family, a new category (e.g. a future
  "gemstone" or "trophy" kind) that skips authoring its name row will either crash or silently
  fall back to a nonsense name. Worth a test (like the existing item/location validation tests)
  that fails the build if any `ItemFamily` in the union lacks a `QUALITY_NAMES` row.
- **The stash's `home_chest`-only container is a soft wall on the "buy land" ask** (professions.md
  gardening wants owned property too) — if property/plots and storage containers evolve
  independently, a character could end up with two unrelated "own a place" concepts (a garden
  plot, a storage container) that should probably be the same underlying "owned location" model.

**Expansion ideas:**
- **A "renowned" tier above Masterwork** for unique, named, quest-rewarded items (a specific
  sword with a history, not just a quality roll) — ties naturally into factions.md/conversations.md
  quest rewards and gives the Imperator a lever for genuinely special loot without a new item
  system, just a flag + a name + a bio field on an instance.
- **Wear tells a story, not just a number.** Once durability/repair exists, flavor text keyed off
  current durability (a "battle-worn" description at 50%, "on its last edge" near 0) makes gear
  feel lived-in for free, reusing text infrastructure the fun commands already have patterns for
  (`lib/text.ts`).
- **Bronze (and future rare materials) as a small economy driver** — since bronze is explicitly
  cost/rarity-gated rather than a free polcan perk, it's a natural first thing worth *trading for*
  once economy.md's shop layer exists, giving polcan smiths (and their trade routes) an actual
  reason to matter mechanically, not just as flavor.
