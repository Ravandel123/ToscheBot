# RPG_SYSTEM.md — the server RPG, as implemented

**Single source of truth for the server-RPG model that is *actually in the code*.** It
must always mirror the code. When you change a model, catalog, value, or rule, update this
file in the same change. High-level *decisions* (why) live in `CLAUDE.md` (D12–D16); this
file is the *what* — concrete fields, values, and rules.

Legend:
- ✅ **decided & built** — structural, stable.
- 🟡 **placeholder** — exists in code but the *numbers/mechanics* are not designed yet
  (D14: no RPG mechanics until the ruleset is designed with the owner). Don't treat
  placeholder values as balance.
- ⬜ **planned** — not built yet.

_Last updated: 2026-07-05 (D34 **BUILT**: the **skill-tree system** — skills are now
arbitrary-depth **trees** in code (`game/data/skills.ts`), a character stores a **sparse
flat node map** under a `progression` subdoc, checks sum the path + a **per-node weighted
attribute blend** (Intimidate = 50% STR + 50% CHA), and **learn-by-doing** credits every
node on a path at its own growth rate. Replaces the old dense 6-skill placeholder; content
& numbers stay 🟡. Prior: D33 the stash — a per-instance `Item` collection browsed by
`/stash`, filled by the 🗄️ Store button.)_

---

## Big picture

- ✅ **Account** = a Discord user. **Character** = an in-game entity (player-controlled or
  NPC). One account owns characters and controls one **active character** at a time.
- ✅ NPC = a Character with `ownerId: null` (movement/AI later, Phase 6C).
- ✅ Currencies and Smackdown ELO are **per character**.
- ✅ Character **creation, editing, and approval** — a step-driven **wizard panel** (D20)
  over `/character …` + owner Approve/Reject — Phase 6B.
- ✅ **Travel** along the location graph (via the `/play` hub's travel select, D21/D30) with a
  **travel-encounter seam** (flavor lines or interactive challenges) — the first `canCharacterAct` + AP consumer.
- ✅ **Durable interactive activities** (D17/D22): registry-dispatched, crash-safe;
  first activity: `challenge` (multi-approach, d100-checked — D26).
- ✅ **Attributes are real (D25)**: eight of them, racial bases, a 50-point creation
  point-buy; consumed by the ✅ **d100 roll-under check engine** (`game/checks.ts`, D26).
  🟡 All *numbers* (bases, pool, difficulty, skill bonus) are balance placeholders.
- ✅ **Deed traits** (courage, cowardice…) accrued by encounter choices; nothing gates on
  them yet.
- ✅ **Inventory & equipment (D28)**: a WHFRP-flavored item catalog + per-character
  instances, standard equipment slots, the `/inventory` panel, `/item grant` as the only
  loot source. Equipped gear shifts **effective attributes** (consumed by challenge checks
  and the sheet). 🟡 All numbers (damage, weights, penalties) are placeholders; nothing
  damages durability yet.
- 🟢 **Persistence model (D32/D33/D34)**: embed *bounded + hot-path* state, split *unbounded*
  state. **Stash BUILT**: owned/stored items (home chest — potentially thousands) live in a
  per-instance **`Item` collection**, browsed server-side by **`/stash`** and filled by the
  **🗄️ Store** button in `/inventory`; the **carried pack + equipment stay embedded** (D28)
  and equip only ever references the pack (equip-from-stash deferred — items go through the
  pack first). **Skills BUILT (D34)**: bounded + hot-path ⇒ embedded — a **sparse node map**
  under the `progression` subdoc (talents/points join it later).
- ✅ **Account settings** (D27): `activeGame`, `dmNotifications` — `/profile` toggles them.
- ✅ **Living locations (D31)**: each location has dynamic state in the `LocationState`
  collection — **weather**, **running events**, **server-wide discoveries**, **stats**
  (danger/prosperity), visits — plus **derived presence** (who stands there, incl. NPCs)
  and a **game clock**; one typed **condition language** gates hub actions ("market
  closed at night", secrets hidden until discovered) and conditional encounters.
  🟡 All weights/durations/chances are placeholder flavor.
- ✅ **Chronicle**: gameplay is ephemeral; noteworthy outcomes go to a public log channel (D24).
- ✅ **Skill trees (D34)**: the model is real (trees, per-node attribute blends, summed
  Effective, sparse storage, learn-by-doing growth); the tree *content* and all *numbers*
  (attribute weights, growth rates) stay 🟡, and no live action *credits* skill use yet
  (the `creditSkillUse` seam awaits the first crafting/combat consumer).
- 🟡 Resource values, combat formula, AP regen rate, encounter stakes — placeholders.
- ⬜ NPC seeding + movement (6C), the full RPG ruleset (Phase 7).

An account owns up to **`MAX_CHARACTERS_PER_ACCOUNT = 3`** characters, all made
explicitly via `/character create` (accounts start with none); the constant lives in
`game/character/rules.ts` and is the only knob.

---

## Entities (MongoDB)

### Account — `db/models/account.ts` ✅
| Field | Type | Notes |
|---|---|---|
| `_id` | string | Discord user id |
| `username` | string | cached, refreshed on contact |
| `activeCharacterId` | string \| null | → `Character._id` |
| `settings.activeGame` | boolean | default **true** — opt-out from future random/ambient game events (D27; no consumer yet) |
| `settings.dmNotifications` | boolean | default **true** — gates bot DMs (consumed by the approval-verdict DM) |
| `createdAt`/`updatedAt` | Date | timestamps |

Created bare on first contact by `accountService.getOrCreate` (`activeCharacterId`
stays `null` until the player drafts a character via `/character create` — no
auto-starter, so `/profile` shows no phantom draft). Settings are read through `accountSettings()`
(defaults fill in for pre-D27 docs) and flipped via `accountService.updateSetting` —
the `/profile` panel's toggle buttons (`profile:toggle:<key>`).

### Character — `db/models/character.ts` ✅ structure / 🟡 stats
| Field | Type | Status | Notes |
|---|---|---|---|
| `_id` | string (uuid) | ✅ | own key (account can own many; NPCs have no account) |
| `ownerId` | string \| null | ✅ | Account id, or `null` for NPC. Indexed. |
| `approvalStatus` | `draft\|pending\|approved\|rejected` | ✅ | unapproved ⇒ can't take character-actions |
| `rejectionReason` | string? | ✅ | set on reject |
| `identity.name` | string | ✅ | |
| `identity.race` | RaceId \| null | ✅ | panel dropdown (6B) |
| `identity.epithet` | string | ✅ | e.g. "Imperator", "the Tavern Keep" |
| `identity.gender` | string | ✅ | panel dropdown — `male`/`female` (`GENDER_CHOICES`) |
| `identity.bio` | string | ✅ | short description (≤1000, fits an embed field) |
| `identity.avatarUrl` | string | ✅ | optional image URL → embed thumbnail (`''` = none) |
| `locationId` | string | ✅ | → `LocationId`, fallback on unknown |
| `resources` | {health,stamina}: {current,max} | 🟡 | values placeholder |
| `actionPoints` | {current, totalEarned} | ✅ rule / 🟡 rate | **no cap** (D15) |
| `attributes` | 8 × number | ✅ shape / 🟡 balance | **effective = racial base + allocation** (D25); stored, recomputed on race/allocation change |
| `attributeAllocation` | 8 × number | ✅ | the creation point-buy (0–20 each, Σ = 50); kept separate so a race switch rebases cleanly |
| `traits` | 6 × number | ✅ shape | deed traits (D26), start 0, clamp ≥0; accrued by encounter choices, nothing gates on them yet |
| `progression.skills` | sparse `{ nodeId → {points,progress} }` | ✅ shape / 🟡 content (D34) | **skill-tree progression** — only trained nodes stored; the tree/relationships live in code (`game/data/skills.ts`), never in the DB, so adding a branch or tree is zero-migration. Stored as a plain object (Mixed) so `progression` can gain talents/points with no schema change (D32) |
| `currencies` | 1 × number | ✅ per-character | `deltradaCoins`, start 0 (D19) |
| `inventory` | ItemInstance[] | ✅ shape / 🟡 numbers | the **carried pack** (D28): `{ instanceId (8-char, rides in customIds), itemId → catalog, quality, quantity, durability?, acquiredAt }`; capped at `INVENTORY_STACK_LIMIT` (50) entries. Owned/stored items (thousands possible) live in the separate `Item` collection (D33 — **built**) |
| `equipment` | { slotId → instanceId } | ✅ | worn/wielded gear; plain object keyed by `equipmentSlots.ts` ids — adding a slot needs no migration |

### SmackdownRecord — `db/models/smackdownRecord.ts` ✅
Keyed by `Character._id`. `{ characterName, eloRating (default 1000), wins, losses }`.
`characterName` is denormalized so the leaderboard needs no join.

### LocationState — `db/models/locationState.ts` ✅ (D31)
One doc per location, keyed by the location id, **created lazily on first read**
(`locationStateService.getFresh` — no seeding step). The dynamic half of the world; the
static half is the code catalog (`game/data/locations.ts`).

| Field | Type | Notes |
|---|---|---|
| `_id` | string | → `LocationId` |
| `weather` | `{ kind, since, until }` | current spell; re-rolled by a **filter-guarded** update once `until` lapses (one concurrent winner) |
| `events` | `[{ eventId, startedAt, endsAt }]` | running location events; lapsed ones swept on read; starts are guarded (`tryStartEvent`) |
| `discoveredFeatureIds` | string[] | **server-wide** — one character's find unlocks the place for everyone (chronicled once) |
| `stats` | `Record<string, number>` | keyed by `LOCATION_STATS` (danger, prosperity); plain object — **adding a stat = one catalog entry, no migration** |
| `visits` | number | total arrivals (flavor/titles fodder) |

**Presence is deliberately NOT stored here**: "who is at the plaza" derives from an
indexed query over `Character.locationId` (`characterService.atLocation` — approved
characters, active or benched, plus every NPC; drafts are not in the world yet). One
source of truth — nothing to drift under concurrent moves.

### Item (owned / stored) — ✅ built (D33) — `db/models/item.ts`
The **two-tier item model**. The **carried pack** stays embedded on `Character`
(`inventory[]`, capped, + the `equipment` slot map — D28) because it feeds hot-path
challenge checks and every equip/use/drop is a single-doc atomic write under the lock.
**Owned-but-not-carried** items (home chest, future bank/property — a hoard can reach
thousands, i.e. **unbounded**) live in this collection instead, **one document per
instance/stack** (never one doc per character — that only rebuilds the giant embedded array):

| Field | Type | Notes |
|---|---|---|
| `_id` | string | a fresh **uuid** (global doc identity) |
| `ownerId` | string | → `Character._id`; indexed with `container` |
| `container` | string | where it's stored: `home_chest` \| … (→ `StorageContainerId`) |
| `instanceId` | string | 8-char handle, unique **within the owner's stash** — rides in customIds |
| `itemId` | string | → `game/data/items.ts` catalog (D10) |
| `quality` | string | per-instance (D28) |
| `quantity` | number | stackable kinds > 1 (a whole stack = ONE doc); a unique instance = 1 |
| `durability` | number? | equippable kinds only |
| `acquiredAt` | Date | preserved across pack ↔ stash transfers |

**`_id` diverges from D33's literal "_id = instanceId"** (owner-noted rationale): the pack's
8-char `instanceId` is unique only *within one character's pack*, so as a global `_id` two
characters could collide (silently overwriting each other's item), and a full-uuid handle
would overflow the 100-char customId budget beside the 36-char character id. So `_id` is a
uuid and `instanceId` is a short handle re-minted unique within the owner's stash.

Indexed `{ ownerId, container }`; the stash UI (**`/stash`**) **reuses the `/inventory`
renderers** (`detailEmbed`/`lineSummary` — categories/sort/pages/card) but **paginates +
counts server-side**: category = the catalog's `itemId $in` set (kind is NOT stored — it
derives from `itemId`), page = `find().sort({acquiredAt}).skip().limit()`, counts = a
`$group` roll-up (≤ catalog-size rows) — the whole stash never loads; the browse-state
`container.kind.sort.page` rides in the customId. A normal character read never touches
this collection. **Transfers** run under the character lock, and — since cross-collection
writes aren't transactional (the codebase stays single-doc atomic, D5/D6) — each transfer
**inserts the destination copy BEFORE removing the source**, so a crash mid-transfer leaves
a recoverable **duplicate, never a lost item** (favor-duplicate-over-loss; a double-click is
already serialized by the lock). **Deposit** = 🗄️ Store on the `/inventory` item card (whole
entry → the container; vacates any slot it referenced). **Withdraw** re-checks encumbrance
(the pack has a carry limit; the stash does not) and lands as a fresh pack entry (no
auto-merge — keeps the transfer simple). **Equip only ever references the embedded pack** —
you withdraw to the pack, then equip; direct equip-from-stash is deferred (owner, 2026-07-05).

---

## Catalogs (content in code — D10)

### Resources — `game/data/resources.ts` 🟡
| key | name | defaultMax | regenPerHour | regenWhileBusy |
|---|---|---|---|---|
| `health` | Health | 20 | 2 | false |
| `stamina` | Stamina | 10 | 5 | false |
Stored per character as `{current, max}`, clamped to `[0,max]` on every write.
`regenWhileBusy: false` ⇒ the resource does **not** tick while the character is in an
active ActivitySession (D23) — the tick is skipped, not deferred. Rising meters
(hunger/stress) — ⬜ not added yet.

### Attributes — `game/data/attributes.ts` ✅ set / 🟡 balance (D25)
The owner's eight (locks `RPG/`'s P5, Luck dropped): `strength, endurance, agility,
dexterity, charisma, willpower, perception, intelligence`. Values live on the d100
roll-under scale: **racial base = `ATTRIBUTE_BASE` (25) ± the race's modifiers**, plus the
creation point-buy. Consumed by `game/checks.ts` (encounter tests) and the placeholder
combat formula.

**Creation point-buy** (`game/character/attributes.ts`): `CREATION_ATTRIBUTE_POINTS = 50`
to distribute, `MAX_POINTS_PER_ATTRIBUTE = 20` on any one attribute (both 🟡 tunable).
A required wizard step; Submit is gated on spending every point. `adjustAllocation`
clamps partially (a `+5` with 3 points left assigns 3).

### Deed traits — `game/data/traits.ts` ✅ shape (D26, `RPG/` P-traits direction)
`courage, cowardice, mercy, cruelty, honor, empathy` — rising meters from 0 (clamp ≥0),
grown by choices in encounters (dive after the drowning stranger → +courage/+empathy;
walk on → +cowardice). Applied via `characterService.applyTraitDeltas` (atomic).
Shown on `/character view` when nonzero. ⬜ Nothing *gates* on thresholds yet — trait-gated
options/titles/stress interplay come with Phase 7.

### Skills — `game/data/skills.ts` ✅ model (D34) / 🟡 content & numbers
Skills are **arbitrary-depth TREES**, not flat levels (`RPG/` P-skilltree, owner-designed
2026-07-05). A `SkillNode` = `{ name, parent (id|null), attributes? (weighted blend),
growth? (profile), cap?, description? }`; the shape lives entirely in code (D10). Starter
trees (all 🟡 content): **smithing** (→ weapon-/armour-smithing → blades/axes/haft, light/
heavy) + a **metallurgy** material tree (the cross-path a recipe also sums); **speechcraft**
(persuade / **intimidate** [0.25 STR + 0.25 CHA] / deceit — the cross-attribute blend demo);
**athletics** (→ swimming/climbing); placeholder combat roots (**melee** → 1H/2H → leaves,
**ranged**, **brawling** → striking).

- **Governing attribute is per-node** and **inherited** from the nearest ancestor that
  declares one (set CHA once on Speechcraft; override only on Intimidate). Weights are literal
  multipliers on the raw attribute — "what a skill depends on" is one edit.
- **Growth profiles** (`GROWTH_PROFILES`: root/branch/leaf, or per-node override) are band
  tables of **uses-per-point** that steepen with points (the owner's numbers: a leaf 5→20,
  a branch 10→30, a root 10→50). Default tier is derived from depth.
- The engine (`game/character/skills.ts`, pure + tested) turns points-on-nodes into the two
  things the game reads: **`effectiveSkill`** (attribute blend + Σ path points, UNCAPPED so
  surplus is Mastery/quality) and **`creditUse`** (learn-by-doing: +1 use to every node on a
  path, each converting to points at its own rate — one "forge a sword" lifts the leaf fast,
  the root slowly). `SKILL_NODE_CAP = 100` (Mastery >100 via special sources is future).

### Currencies — `game/data/currencies.ts` ✅ (per-character)
**One currency: `deltradaCoins`** — starts 0, clamped `>= 0`. The lore's regional per-race
currencies (amber drops, pearl flakes, obsidian chips…) return **with** the exchange/trade
economy layer (`RPG/` P17), not before — D19: append a currency when it means something;
never park six empty wallets.

### Races — `game/data/races.ts` ✅ ids / 🟡 balance
`canid, ermehn, felis, lutren, polcan, tamian, vulpin`. Each carries **`attributeModifiers`**
(D25): net-zero **+5 to two, −5 to two** on `ATTRIBUTE_BASE`, from `RPG/Ruleset.md` §4
(Toughness→Endurance, Fellowship→Charisma). A test enforces the net-zero invariant.

| race | +5 / +5 | −5 / −5 |
|---|---|---|
| canid | strength, willpower | agility, charisma |
| ermehn | agility, dexterity | strength, charisma |
| felis | agility, intelligence | strength, endurance |
| lutren | dexterity, charisma | strength, willpower |
| polcan | strength, endurance | agility, charisma |
| tamian | agility, perception | strength, endurance |
| vulpin | charisma, intelligence | strength, willpower |

Races can also carry **check affinities** per encounter option (not on the race itself):
e.g. the drowning-stranger swim check gives lutren a ×1.5 chance multiplier.

### Locations — `game/data/locations.ts` ✅ graph / 🟡 content
`spire` (start) ↔ `plaza` ↔ `tavern`, `plaza` ↔ `riverbank`. The `connectedTo` graph is
**undirected and test-enforced** (`game/world/travel.test.ts`: every edge exists, is listed
on both ends, no self-loops — a bad edit fails `npm test`). A location MAY carry a
`channelId`. Not Discord channels by default. Stale stored ids resolve to the starting
location (`resolveLocationId`, D10 rule 3). The location set itself is placeholder content.

Since D31 a location also carries (all optional, all test-validated in `locations.test.ts`):
- **`climate`** — weather-weight overrides (riverbank: more fog/rain);
- **`features`** — discoverable points of interest `{ id, name, discoveryLine }`, hidden
  until someone finds them (currently: the riverbank's `old_jetty`, revealed by the
  night-only `reed_glimmer` encounter);
- **`baseStats`** — starting values for the dynamic stats (riverbank danger 20…).

### Weather — `game/data/weather.ts` ✅ shape (D31) / 🟡 content
`clear, overcast, rain, storm, fog` — each `{ name, emoji, hubLine, durationHours,
defaultWeight }`. A location's current **spell** lives in its LocationState and is
re-rolled lazily when it lapses (`rollWeather`: location climate over default weights).
Consumed by hub display and `weather` conditions; 🟡 no mechanical effect on checks yet.

### Location events — `game/data/locationEvents.ts` ✅ shape (D31) / 🟡 content
Transient happenings that switch ON at a place for a few hours: `market_day` (plaza,
daylight), `bards_night` (tavern, evening/night — unlocks the `listen` hub action),
`garrison_drill` (spire, daylight). Each `{ name, emoji, banner, locations, conditions?,
startChancePercent, durationHours }`. Rolled on qualifying arrivals
(`game/world/events.ts`), started via the guarded `tryStartEvent` (of two simultaneous
arrivals only one starts + announces it), swept on read after `endsAt`, bannered on the
hub, chronicled when they break out.

### Location stats — `game/data/locationStats.ts` ✅ shape (D31) / 🟡 numbers
`danger` (0–100, bands calm→perilous) and `prosperity` (0–100, destitute→opulent).
Stored per location in LocationState (missing keys fall back to `baseStats`/defaults —
adding a stat needs no migration). Consumers: **danger raises the travel-encounter
chance** (`travelEncounterChance`), both color the hub line.
`locationStateService.adjustStat` (clamped) is the write seam — ⬜ nothing drives the
values yet (event/outcome deltas wait for balance).

### The game clock & conditions — `game/world/{time,conditions}.ts` ✅ (D31)
`timeOfDay()` maps the real clock (fixed owner-timezone UTC offset, `GAME_UTC_OFFSET_HOURS`)
to `morning / day / evening / night`. **One condition language** gates everything:
`LocationCondition = { timeOfDay?, weather?, duringEvent?, requiresDiscovery?, minTraits? }`,
evaluated by `evaluateCondition(condition, worldContext(state, character))` with a short
player-facing reason on failure ("only during the evening or night"). Used by hub-action
`availability` (+`hidden` for secrets), encounter `conditions` and event start conditions.
`minTraits` is the **first thing that reads deed traits** (the plaza beggar greets
`empathy ≥ 1`).

### Travel encounters — `game/data/encounters.ts` ✅ model (D21/D26/D31) / 🟡 content & numbers
Rolled on each travel move (from the `/play` hub, D30) (`TRAVEL_ENCOUNTER_CHANCE_PERCENT`
**+ the destination's danger** — `travelEncounterChance`; weighted pick from
the pool eligible for the destination; `locations: [...ids] | 'anywhere'`). Since D31 an
encounter may carry **`conditions`** (the shared condition language — time of day, weather,
running events, discoveries, min traits: the owner's "walk in and if a criterion holds,
something happens") and flavor encounters / challenge outcomes may **`discovers`** a
location feature (revealed server-wide + chronicled exactly once). Conditional content so
far: `soaked_traveler` (rain/storm), `grateful_beggar` (plaza, empathy ≥ 1),
`reed_glimmer` (riverbank at night — discovers the old jetty). Two kinds:
- **`flavor`** — instant: a random line is appended to the arrival message + chronicle. The
  move completes normally. (`patrol_gossip`, `dropped_ribbon`)
- **`activity`** — interrupts the move with a durable **`challenge`** ActivitySession and
  exposes **several approaches** (`options`, D26). Each option is either:
  - a **d100 check** (`CheckDefinition`: attribute, optional skill, difficulty modifier,
    per-race affinity multiplier) with `success`/`failure` outcomes, or
  - a **free choice** (no check — its `success` outcome just happens).

  An outcome (`ChallengeOutcome`) is `result` + flavor `lines` + optional **trait deltas**:
  `proceed` completes the journey, `turn-back` ends it at the origin, `retry` keeps the
  challenge going — each failed retry is a **setback**, and `maxSetbacks` forces the
  character back. `oneShot` options are retired after one failure (there either is a gap
  around the tree, or there is not). Option ids are stable slugs riding in customIds;
  a content test enforces unique option ids + a `failure` on every checked option.

  Current content: `fallen_tree` (climb AGI / heave STR / search PER one-shot) and
  `drowning_stranger` (riverbank: swim AGI+Swimming, lutren ×1.5, +courage/+empathy ·
  find a branch PER, +empathy · **walk on** — free, +cowardice).
Stakes with real mechanics (damage, loot) wait for the Phase 7 ruleset (D14).

### Items — `game/data/items.ts` ✅ shape (D28) / 🟡 every number
A **discriminated union** by `kind`; adding a kind = one union member + one `ITEM_KINDS`
meta entry (name, emoji, `stackable`) — the panel renders categories from the meta.
WHFRP-flavored on purpose (`RPG/Ruleset.md` §8): gear is a choice, not a stat stick.

| kind | stackable | key fields |
|---|---|---|
| `weapon` | no | `damage {min,max}` 🟡, `reach` (very short→very long), `hands` (1/2), `properties` (WHFRP-style: piercing, entangling, fast, slow, impact, defensive, hack, pummel, precise — descriptors until Phase 7 combat), `durabilityMax`, `slots` |
| `shield` | no | `armor` (AV) 🟡, `durabilityMax`, `slots` |
| `armor` | no | `armor` (AV) 🟡, `durabilityMax`, `slots` (worn on head/chest/hands/legs/feet) |
| `consumable` | yes | `effects` — resource deltas applied on use (rations +5 stamina, poultice +5 health) |
| `material` | yes | crafting stock (iron ingot, oak timber…) — no consumer yet (⬜ crafting) |
| `clutter` | yes | flavor junk with a wink (bent spoon, mysterious sock) |

Every equippable may carry **`attributeRequirements`** (STR 40 to wield the war maul —
checked against BASE attributes so donning order can't matter) and **`attributeModifiers`**
(steel breastplate **AGI −10, DEX −5**; steel helm **PER −5**; same shape as racial
modifiers). Common fields: `name`, `description` (in-character), `material` (→ `MATERIALS`
mini-catalog; bronze is deliberately pricey — polcan monopoly per canon), `weightKg`,
`value` 🪙 (display-only until the economy, D19).

**Craftsmanship quality is per INSTANCE** (`ITEM_QUALITIES`: poor → common → fine →
masterwork): one catalog entry drops at any tier. 🟡 Quality scales **durability max and
value only** ('Battered/Fine/Masterwork' name prefix); quality×damage waits for Phase 7.
~30 items ship as the starter catalog; ids are append-only (D10) and **test-validated**
(`items.test.ts`: legal slots, ordered damage ranges, positive weights, 2H ⇒ main hand
only, non-zero effects/modifiers — a bad entry fails `npm test`).

### Equipment slots — `game/data/equipmentSlots.ts` ✅ (D28)
`mainHand, offHand, head, chest, hands, legs, feet`. The character's `equipment` map is a
plain object keyed by these ids, so **adding a slot** (cloak, trinket, ammo…) **= one
catalog entry + items that use it — no migration**. Weapons declare which slots fit
(a dagger fits either hand → the panel offers a slot choice); **two-handed** weapons live
in `mainHand` and freeze `offHand`.

### Storage containers — `game/data/containers.ts` ✅ (D33)
Where stashed items live. One so far: `home_chest` (`{ name, emoji, description }`).
`DEFAULT_CONTAINER = home_chest` is what the 🗄️ Store button targets. **Adding a container**
(bank, saddlebags…) **= one entry** (+ wherever it becomes reachable); ids are append-only
(D10) and stored on `Item` docs. Not location-gated yet — every container is reachable via
`/stash` (tying a container to a place/hub action is a future step).

---

## Rules

### Checks — the d100 core test — `game/checks.ts` ✅ shape (D26/D34) / 🟡 numbers
The resolution mechanic locked in `RPG/` (R1): **roll d100, succeed on roll ≤ target.**

```
Effective = Σ(weight·attribute)  (primary node's blend)  +  Σ(points on the path root→leaf)
                                                          (+ any extraNodes: material paths)
target    = round((Effective + modifier) × raceAffinity), clamped to [5, 95]
SL        = tens(target) − tens(roll)     (Success Levels; negative on a failure)
```

- A check draws on a **skill node** (`node` + optional `extraNodes`) — the summed-tree model
  (D34) — **or** a bare **`attribute`** (untrained feats like climbing a fallen tree; optional
  `attributeWeight`, default the whole attribute).
- **`checkEffective`** returns the raw, UNCAPPED capability (surplus over an item's required
  sum is future crafting quality / combat Mastery); **`checkTarget`** shapes it by difficulty
  + affinity and clamps to a d100 %.
- `modifier` is the difficulty-ladder step (🟡 values pending `RPG/` P11); `raceAffinity` a
  per-check chance multiplier (`{ lutren: 1.5 }` on swim). The [5, 95] clamp keeps nothing
  impossible/guaranteed.
- Consumers roll via `rollAgainst(target)` — challenge panels **store per-option targets in
  session state at creation**, so the shown % and the rolled % always agree.

### Action Points (AP) — ✅ rule, 🟡 rate
- **No cap.** Accumulate via the hourly regen `$inc` (`current` and `totalEarned`) — and
  they accrue **even while the character is busy** in an activity (D23).
- Spent only through `characterService.spendActionPoints(id, cost)` — atomic
  check-and-spend (filter requires `current >= cost`; can't overdraw under concurrency).
- Regen rate is a placeholder (`AP_REGEN_PER_HOUR = 1`).
- Consumers: ✅ travel (the `/play` hub) goes through the spend path with `TRAVEL_AP_COST = 0` (🟡 a
  placeholder price — the wiring is real, the number waits for Phase 7). An activity
  spawned by travel is covered by that charge (D17: charged at start; clean cancel
  refunds; timeout/abandon forfeits).

### Approval lifecycle — ✅ field + workflow
`draft → pending → approved / rejected`.
- A player builds their **active** character on an **interactive panel** (see below) while
  it's `draft` or `rejected` (`rules.ts → canEdit`), then **Submit** (`rules.ts → canSubmit`:
  needs a 2+ char name and a race) flips it to `pending` and posts a **petition** (embed +
  Approve/Reject buttons) to the owner-only `imperialDecrees` channel.
- The owner clicks **Approve** (→ `approved`) or **Reject** (a modal asks for a reason →
  `rejected` + `rejectionReason`). The verdict repaints the petition message and is DM'd to
  the player (best-effort). Rejected characters are editable + resubmittable (the panel shows
  the rejection reason); approved ones are sealed (`canEdit` false).
- All three transitions are **status-guarded atomic updates** (`submitForApproval`:
  draft|rejected→pending; `approve`/`reject`: pending→…) returning `false` on a stale
  request — so a leftover decree message's buttons can't approve a character that was
  since decided or re-edited (they answer "no longer pending" instead).
- `game/character/rules.ts → canCharacterAct(character, apCost)` gates *character actions*:
  requires `approved && health > 0 && actionPoints.current >= apCost`. **Viewing**
  (`/character view`, inventory) never uses this gate; a 0-HP character can be active and
  inspected, just can't act. ✅ **First consumer: travel** (the `/play` hub) — unapproved characters can't
  roam. Sparring stays deliberately ungated (D16); the serious duel (Phase 7) is next.

### Character lifecycle commands — ✅ (Phase 6B, wizard since D20)
`/character` subcommands:
- `create` → a text **modal** (name required) makes a new draft (capped at
  `MAX_CHARACTERS_PER_ACCOUNT`, set active) and lands on the **wizard panel**.
- `edit` → opens the **wizard panel** for the active draft (this is also how an
  interrupted creation is **resumed** — any time, even after a bot restart).
- `view [user]` → the public **character sheet** (D27 — the pre-split `/profile` embed):
  status, race, location, AP, vitals, currencies, **attributes**, nonzero **traits**.
- `list` → your characters + status + active marker.
- `switch` → autocomplete → change active character.
- `race` / `submit` → still work as standalone shortcuts, but the panel covers both.

**`/profile` is the ACCOUNT surface since D27**: an ephemeral panel with the active
character, character count and the settings toggles (see Account above).

The **creation wizard** (D20) is one ephemeral panel driven by the **step catalog**
`game/character/creationSteps.ts` — currently `details` (modal: name required 2–32, epithet
≤50, bio ≤1000, avatar URL ≤400), `race` (select, required), `gender` (select, required,
`GENDER_CHOICES`) and `attributes` (required, D25). The panel's **overview** shows a ✅/⬜
checklist with per-step summaries, a **step picker** (jump to and redo ANY step while
editable), **Continue** (jumps to the first unfinished step) and **Submit** (enabled once
every *required* step is done — `canSubmit` reads the catalog). Select-kind steps open a
focused **step view** (that step's dropdown + Back); modal-kind steps open their modal
directly. An avatar URL renders as the embed **thumbnail** (also on `/character view` and
the petition).

The **attributes step** is a step view with a monospace `base + assigned = effective`
breakdown, an attribute **picker** (which one the buttons adjust — the focus rides in the
button customIds, nothing is stored) and **−5 / −1 / +1 / +5 / Reset** buttons, live-capped
by the pool and the per-attribute max. Changing race later **rebases** the same allocation
onto the new racial base (`setRace` recomputes effective attributes atomically).

**There is no stored wizard cursor.** The draft doc is the wizard state; progress is derived
from which fields are filled, and every customId carries the character id — so the flow is
interruptible, resumable across restarts, and editable until approval with nothing to
desync (no collector; matches the `comic` browser pattern). **Adding a creation step** =
one catalog entry + one renderer case (`SELECT_STEP_ROWS` in `_characterPanel.ts` for a
select, or a modal builder in `_characterModals.ts`).

### Active-character switching — ✅ service + command (session-aware since D22)
`/character switch` → `accountService.setActiveCharacter(userId, username, characterId,
locks)`: only your own character; blocked if the current OR target character is **busy** —
in-memory locked (mid-fight) *or* in an active `ActivitySession` (mid-climb; this half
survives restarts). 0-HP / unapproved characters *can* be activated. This switch guard is
what enforces "one user, one live activity at a time" — the locks themselves are per
**character** (see CLAUDE.md "Concurrency model").

### Travel — ✅ (D21; hub D30; world state D31; numbers 🟡)
Travel is a **`/play` hub action**, not a standalone command (the old `/travel` was folded
in — D30). The hub shows the location's **weather + time + danger/prosperity line, running
events, and who is standing there** (players + NPCs, viewer marked, capped name list), and
its **"Travel to…" select** lists the connected locations; picking one moves
the **active** character along the graph. Flow (component `deferUpdate` first, whole decision
under `runExclusive([characterId])`): re-check busy (an active session **re-enters** —
re-renders its current step instead of erroring) → `canCharacterAct(character, TRAVEL_AP_COST)`
→ edge check (`game/world/travel.ts → checkTravel`, stale origins fall back to start) → atomic
AP spend → read the **destination's live state** (`getFresh`) → conditional encounter roll
(danger-biased chance) → either `setLocation` + `recordVisit` + possible **feature
discovery** + possible **event start** + **re-render the hub at the destination**
(+ banners) or an interrupting activity session (see below). Replies are ephemeral;
arrivals/outcomes/discoveries/event starts go to the **chronicle** (D24). The travel
execution lives in `commands/components/_playPanel.ts`; the shared hub view + context
loader in `_hubView.ts`. **Local action buttons** are filtered/disabled by their
`availability` conditions at render AND re-validated at click time (stale panels: the
character may have moved, night may have fallen, the event may have ended). Multiple open
hubs stay safe: the character is re-read under its lock, and every LocationState write is
filter-guarded.

### Inventory & equipment — ✅ (D28; numbers 🟡)
- **`/inventory`** — ephemeral panel for the **active** character: **hub** (equipment by
  slot, armor total + attribute-modifier summary, load `carried/capacity kg`, per-category
  counts) → **category list** (sort by name / weight / value / newest, 10 per page) →
  **item card** (kind-specific stat block, durability, requirements ✓/✗, quality/material/
  weight/value) with contextual actions: Equip (slot choice when several fit) / Unequip /
  Use / **Store** (→ the stash, when not worn) / Drop (explicit confirm). Browse state
  (`kind.sort.page`) rides in customIds — stateless, restart-proof.
- **`/stash`** — the retrieval side of the two-tier item model (D33): an ephemeral panel
  reusing the `/inventory` renderers over the **`Item` collection** (owned-but-not-carried
  items). Hub (per-category counts) → category list (server-side, `acquiredAt`
  newest/oldest, paged) → item card → **Withdraw**. Deposit is the 🗄️ **Store** button
  above; withdraw re-checks the pack's entry cap + carry capacity. Both transfers run under
  the character lock and are refused while busy. See the `Item` collection for crash-safety.
- **Equip rules** (pure, `game/character/inventory.ts → planEquip`): legal slot ·
  requirements vs **base** attributes · broken gear refused · a two-handed weapon vacates
  the off hand and blocks it while wielded · equipping into an occupied slot displaces the
  occupant (it stays in the pack) · moving an equipped item frees its old slot. The plan is
  applied atomically by `inventoryService` (filter-guarded on the instance still existing).
- **Effective attributes** = stored attributes + Σ equipped `attributeModifiers`, floored
  at 1 (`attributesWithEquipment`). Consumers: travel-challenge **check targets** (computed
  at session start; gear is frozen while busy, so stored targets stay honest) and
  `/character view` (shows `effective (base±mod)` + an Equipment field).
- **Concurrency**: every mutation runs under the character lock with a fresh re-read and
  is **refused while busy** (in-memory locked or in an active session). The two-open-panels
  race (drop in window B, equip in window A) resolves to a typed "no longer in your pack"
  note — never a double-spend. Browsing is read-only and lock-free.
- **Consumables**: one charge per use — quantity-guarded decrement, then the catalog
  `effects` as a clamped resource delta; the last charge removes the stack.
- **Acquisition**: `/item grant player item [quality] [quantity]` (ownerOnly, autocomplete
  over the catalog) is the **only** item source for now; it enforces the 50-entry cap and
  🟡 carry capacity (= strength in kg; over-capacity blocks acquisition only — no movement
  penalty yet). Unapproved characters CAN manage gear — it's sheet-building, not a
  character action (same stance as the creation wizard; `canCharacterAct` untouched).
- ✅ **Player storage** — the two-tier `Item` collection is **built** (D33): `/stash` +
  the 🗄️ Store button; equip-from-stash stays deferred (items go through the pack first).
- ⬜ Not built (by design, prototype scope): loot sources (fishing/shops/loot tables/
  starting kit), a second container + location-gated access (bank, home), a
  withdraw+equip convenience wrapper, durability damage + repair, partial-stack
  transfers/drops, ground piles + player trading, ranged weapons + ammunition,
  auto-equip-best (the `RPG/` §14 simple layer), selling (economy, P17),
  quality×damage interplay (Phase 7).

### Durable activities — ✅ scaffold + registry + first consumer (D17/D22)
Long, interactive, multi-step activities (turn-based duel, obstacles, exploration) are made
**crash-/restart-safe** by persisting state per step instead of holding it in memory:
- **`ActivitySession`** (`db/models/activitySession.ts`): `{ type: duel\|exploration\|challenge,
  participantIds, step, status: active\|completed\|abandoned, state (opaque blob), expiresAt }`.
  It's both the saved state *and* the cross-restart "this character is busy" lock.
- **`activitySessionService.advance(id, expectedStep, state)`** is a step-guarded atomic
  update → each step is idempotent against double-clicks and crash-replay.
- Components carry the `sessionId` (stateless), so buttons survive a restart — **even on
  ephemeral messages** (the interaction, not the message, is what gets updated).
- A **TTL index** on `expiresAt` (refreshed each step) auto-reaps idle/abandoned sessions.
- **AP policy (default, tunable):** charged at start; clean cancel refunds; **timeout/abandon
  forfeits** (a TTL delete then needs no side effect).
- **Registry dispatch (D22):** `commands/components/_activities/registry.ts` maps
  `session.type → ActivityHandler { render, onAction }`; the generic `activity` component
  namespace (`activity:<action>:<sessionId>`) resolves the session, checks liveness (incl.
  lazy expiry) and that the clicker **owns** a participant character, then dispatches.
  Unknown/retired types degrade to "this activity has ended" (D10 rule 3).

#### The `challenge` activity — ✅ pattern + real checks (D26; replaced `obstacle`)
Spawned by an `activity` travel encounter (`fallen_tree`, `drowning_stranger`). State
(`game/activity/challenge.ts`, pure + tested): `{ encounterId, fromId, toId, setbacks,
spentOptionIds, optionTargets, lastLine, resolution }`. The panel shows the encounter intro,
each available approach with the actor's **honest % chance** (targets computed from the
live character at session start, stored in state), and one button per option + **Turn back**.

Each option click = one d100 `rollAgainst(storedTarget)` (or an auto-success for check-free
options) → the option's `success`/`failure` outcome → committed via `advance` (flavor line
+ roll summary ride in the state, so repaints are stable). Trait deltas and feature
**discoveries** (`outcome.discovers`, D31) apply after the step guard is won (atomic,
at-most-once; a crash there loses at most one flavor point — accepted). `proceed` ⇒ arrival
(`setLocation` + `recordVisit`), `turn-back` (or `setbacks ≥ maxSetbacks`)
⇒ stays at origin; **Turn back** = clean cancel (`abandon`, refund seam); timeout ⇒ TTL
reap ⇒ stays at origin, no side effect needed. Outcomes are chronicled. Every ending
(proceed / forced back / retreat) **re-renders the `/play` hub** at wherever the character
stands, so the loop continues (D31). **Crash-safe
completion:** the terminal outcome is *stored in state* (`resolution`), the final `advance`
doubles as the completion mutex, side effects (move, chronicle, delete) are idempotent, and
if the bot dies mid-tail, `render` shows a "Press on" **finalize** button that re-runs it.
This file is the reference pattern for the future duel/NPC-talk/exploration handlers.

Short auto-resolved actions (sparring) do **not** use sessions — they commit atomically
(D5 rule 1).

### Hourly regen — ✅ (busy-split since D23)
`jobs/resourceRegen.ts` writes three bulk-first groups (D7/D23):
1. **Free characters** → `characterService.regenAll(excluded)` — full tick (vitals clamp to
   max, AP grows).
2. **Session-busy characters** (from `activitySessionService.activeParticipantIds()`) →
   `regenAllBusy(ids)` — **AP only** (+ any resource flagged `regenWhileBusy`); paused
   vitals are skipped outright, not deferred.
3. **In-memory-locked characters** → `deferOrRun` a single-character `regen(id)` that
   decides full-vs-busy **when it executes** (the lock is gone, but a durable session may
   still be running).

### Chronicle — ✅ (D24)
`game/chronicle.ts → postChronicle(client, line)` posts short in-character lines to
`settings.channels.chronicle` (default name `chronicle`). Used by travel arrivals and
obstacle outcomes; future duels/events should chronicle too. Best-effort: a missing channel
logs a warning and never fails the action; lines never ping (`allowedMentions: []`).
Convention: **gameplay replies are ephemeral, the chronicle is the public record.**

---

## Combat

### Sparring — ✅ (for-fun tier, D16)
`/smackdown sparring opponent:@user`. Fights both players' **active characters** (no
approval needed). Locks both characters (`runExclusive`), auto-resolves in memory, narrates
round-by-round in `#smackdown-spire` with delays, updates **per-character ELO**. Does NOT
persist HP (fantasy match) — only ELO is committed, at the end. ELO here is **temporary**
and will be removed from sparring later.

🟡 Combat formula (`game/combat/engine.ts` + `stats.ts`): per round, attacker
`d20 + attackBonus` vs defender `d20 + defenseBonus`; on hit, damage from strength,
cleanliness, endurance. Bonuses are the attribute's tens digit; `maxHp = strB*5 + wpB*5 +
endB*10`. **Placeholder** — since D25 attributes differ per race/point-buy so builds bleed
through slightly, but the shape is throwaway; the real d100 opposed-test combat waits on
the ruleset (`RPG/` §9).

### Duel — ⬜ (serious tier)
Future `/smackdown duel`: requires **approved** characters, uses real HP/attributes,
**costs AP**, persists outcomes. Designed in Phase 7.

---

## Services (where state changes)

- `accountService` — getOrCreate (bare account, no auto-starter), getActiveCharacter,
  peekActiveCharacter (read-only — viewing someone / autocomplete must not create their
  account), setActiveCharacter (busy-aware: locks + active sessions), getSettings /
  updateSetting (D27 account settings, defaults for pre-D27 docs).
- `characterService` — get, getOwned, countOwned, create,
  updateIdentity, setRace (rebases effective attributes in-pipeline — D25),
  setAttributeAllocation (persists point-buy + recomputed attributes),
  submitForApproval/approve/reject (status-guarded, return false on a stale transition),
  applyResourceDeltas (clamp [0,max]), applyCurrencyDeltas (clamp ≥0), applyTraitDeltas
  (clamp ≥0 — D26), creditSkillUse (learn-by-doing, D34 — read-modify-write on the sparse
  map under the caller's lock; returns the nodes that ranked up; no live consumer yet),
  spendActionPoints (atomic), setLocation, atLocation (derived presence
  over the indexed `locationId` — D31), regenAll/regenAllBusy/regen (the D23 busy split).
- `locationStateService` (D31) — getFresh (lazy create + guarded weather re-roll + event
  sweep), tryStartEvent (guarded: one starter among concurrent arrivals), discoverFeature
  ($addToSet; true = newly found), adjustStat (clamped to the catalog range — the ⬜ write
  seam), recordVisit. Every write is an atomic filter-guarded single-doc update; no
  location locks needed.
- `inventoryService` — grantItems (stack-merge or per-unit instances; cap + capacity
  checks), removeStack (drop + vacate referencing slots, one write), applyEquipPlan /
  clearEquipmentSlot, consumeItem (quantity-guarded decrement + resource effects). All
  callers hold the character's lock; every write is filter-guarded besides (D28).
- `itemService` (D33) — the stash (`Item` collection): countByKind + browseStash (both
  server-side, never load the whole hoard), getStashItem, deposit (pack → container:
  insert-then-pull, vacate slot), withdraw (container → pack: capacity re-check, push
  fresh-pack-instance-then-delete). Transfers hold the character's lock;
  favor-duplicate-over-loss on a crash mid-transfer (cross-collection, non-transactional).
- `smackdownService` — getOrCreate, recordResult (Elo), getLeaderboard.
- `activitySessionService` — create, getActiveForParticipant, activeParticipantIds (the
  durable busy set), advance (step-guarded), complete, abandon. The durability layer for
  long activities (D17) — see below.

All character writes go through services; commands stay thin. Discord buttons/selects/modals
are handled by `commands/components/*` (keyed by customId namespace) — `character.ts` owns
the wizard/approve/reject flows, `activity.ts` routes durable activities to the
`_activities/` registry; `_`-prefixed siblings build the embeds + modals + activity views.

---

## Open questions / TBD (Phase 7 ruleset — design with owner before coding)

- ~~What attributes exist~~ → **decided (D25)**; balance of racial bases / pool / caps
  stays 🟡 pending `RPG/` P6 (Strength/finesse) and playtesting.
- ~~What the check engine's skill term is~~ → **the summed skill-tree model is BUILT (D34)**:
  `effectiveSkill` = per-node attribute blend + Σ path points; storage is a sparse node map
  under `progression` (D32). **Remaining 🟡:** the tree *content* (only prototype trees ship),
  all *numbers* (attribute weights `w`, growth rates, caps), quality-gated practice-source
  caps (home < workshop < commission — `RPG/` §7), Mastery >100, talents + the points economy
  (`RPG/` P13/P14), and **wiring `creditSkillUse` into a live action** (crafting/combat) so
  skills actually grow. Item **required-sum** gates + crafting quality (`RPG/` Examples) are
  the natural first consumer.
- Difficulty-ladder values on checks (`RPG/` P11) and where race affinities vs racial
  *traits* (Amphibious…) draw the line.
- Real combat math (opposed d100, Wounds/Soak — `RPG/` §9/R10), max-HP / regen formulas
  from attributes (the `recalculateMaxResources` seam).
- AP costs per action (travel currently 0; the spend path is wired); whether AP ever
  needs a cap.
- Encounter stakes: damage/loot on challenge outcomes, richer per-location/edge tables;
  trait *consumers* (trait-gated options, titles, stress interplay — `RPG/` P-traits).
- Ambient/random events (the `activeGame` flag's consumer — backlog "Ambient events").
- Economy: how currencies are earned/spent; per-character wallets interactions.
- Locations: full map, travel costs, what NPCs do there (per-location activity tables).
- World state drivers (D31 follow-ups): what nudges danger/prosperity (`adjustStat` has no
  writer yet), weather-modified check difficulty, per-character discoveries, more
  weathers/events/features, event-driven encounter pools.
- Items (D28 follow-ups): where loot comes from (fishing, shops, encounter rewards, a
  starting-kit wizard step); durability loss + repair; quality×damage; encumbrance
  consequences (movement/AGI penalties vs the current acquisition-only gate); item checks
  as challenge approaches (`RPG/` P-challenges: a rope trivializes the fallen tree);
  partial-stack drops, ground piles, player-to-player trading; ranged weapons + ammo;
  the auto-equip-best button (`RPG/` §14 simple layer). Player **storage** (home chest/
  bank) is **built** — the two-tier `Item` collection (D33), `/stash` + Store, equip
  through the pack; a second/location-gated container and a withdraw+equip wrapper remain.
