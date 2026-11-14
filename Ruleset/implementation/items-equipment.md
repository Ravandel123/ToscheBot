# Items & Equipment — implementation

What exists in `src/` today for the rules in [items-equipment.md](../items-equipment.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

### Modifiers and timed effects — `game/character/modifiers.ts`, `game/data/effects.ts` ✅ / 🟡 numbers *(D55)*
Everything that shifts a character's numbers is collected in one place. A **source** is gear
(the summed `attributeModifiers` of what is equipped) or a running **timed effect**; each
source may shift attributes and/or add a flat bonus to every check target. Rolls never read a
raw character: skill checks, gathering, identification, dialogue, travel challenges and combat
profiles all build their subject with `checkSubject(character)`. A bare-knuckle bout passes
`{ gear: false }` — gear is set aside, effects still apply. A one-off bonus for a single roll
(an effort level, a tool) is not a source; it goes in that check's own `modifier`.

Timed effects are catalog entries (`name`, `durationMinutes`, attribute shifts, check bonus).
A character stores only `effects: [{ effectId, expiresAt }]` — optional, capped at 10. Expired
entries are ignored on read and pruned the next time an effect is applied; re-applying an
effect restarts its clock instead of stacking. A consumable starts one through
`grantsEffect`. The first: **Honeyed Mead → Dutch Courage** (+5 Willpower, −5 Perception,
2 hours 🟡). The character sheet lists running effects with their end time.

### Starter kit — `game/data/starterKit.ts` ⏸ built, switched off / 🟡 contents *(D54)*
**Switched off since 2026-11-14** (`STARTER_KIT_ENABLED = false`; the owner wants to look at
what a new character should receive first). Nothing is issued. The mechanism below is intact
and tested; flipping the flag issues the kit on each character's next `/play`, including
characters created while it was off.

When on, every approved character is issued one kit, once: an Iron Dagger, a Leather Jerkin and two
Healer's Poultices (all common quality). It is handed over on the character's first `/play`
(`inventoryService.issueStarterKit`, under the character lock) and tracked by the optional
`starterKitGranted` flag on the character — absent on older documents, so characters that
existed before the kit, and seeded ones, receive it as well. The flag is set even when an
item did not fit the pack: the kit is offered once, not retried. With the kit off, a new
character gets gear from the plaza stall (economy.md) or from the owner's `/item grant`.

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
- **Per-location AV** and the **armour ✕ weapon-type multiplier** (combat.md R12) — armour is one
  global AV today.
- Selling / pricing beyond a flat display-only `value` (economy.md).
