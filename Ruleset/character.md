# Character — Account, Character, attributes, races, creation

See [README.md](README.md) for the legend and how this file is structured.

---

## Ruleset

### Account ↔ Character ✅ R5/D12
An **Account** is one Discord user. A **Character** is the game entity — player-owned or an
**NPC** (no owner). One account can own several characters but controls exactly one **active**
character at a time; currencies and combat rating (Smackdown ELO) belong to the *character*,
not the account, because a player may switch between very different personas.

### Approval lifecycle ✅ D13
A character exists the moment it's drafted, but a **draft** cannot take character-actions
(serious combat, travel…) until the owner (the "Imperator") approves it. This stops low-effort
names/personas: the Imperator vets that each character is a real, fitting BtWD persona before
it can act or appear on ladders. Rejected characters can be edited and resubmitted.

### Attributes — eight, roll-under scale ✅ set / 🟡 balance *(was P5)*
Attributes are the **root of every skill tree** (skills.md) and feed derived combat stats
(combat.md) — they are not themselves a test target; in a test they contribute a **weighted
term** to the Effective sum. The set (owner's final call over the WHFRP-style 8-characteristic
starting point):

| Attribute | Governs |
|---|---|
| **Strength** | melee damage, carrying, breaking |
| **Constitution** *(was "Toughness")* | soak, Wounds, resistance to disease/poison/fatigue |
| **Agility** | speed/reflexes, melee to-hit, Dodge, initiative |
| **Dexterity** | fine work, ranged to-hit, crafts, sleight, locks |
| **Charisma** *(was "Fellowship")* | charm, persuade, deceit, command, haggle |
| **Willpower** | resolve, fear, Stress/Madness resistance, leadership |
| **Perception** | senses, awareness, tracking, searching |
| **Intelligence** *(was "Intellect")* | knowledge, lore, literacy, medicine, engineering |

**Why 8, and why no separate Weapon/Ballistic skill:** WHFRP runs ~10 characteristics
including dedicated combat stats. Those fold into the **Melee**/**Ranged** *skills* instead
(agility-/dexterity-rooted) — an attribute should always mean a *concept*, never "how I swing
a sword." 8 is the floor that still lets seven races feel mechanically distinct; six would
blur them. A "Luck" attribute (Fallout-inspired) was considered and dropped.

⚠️ **Attribute double-dip — the load-bearing constraint for the future points economy
(skills.md):** an attribute feeds *every* tree rooted on it *and* the derived stats, so buying
one point of attribute is broadly powerful. Whenever the points economy is designed, attribute
advances must be priced steeply (or milestone-gated), or "just buy Agility/Strength" becomes
the only rational spend.

**Attributes do not rise by use** (unlike skills) — they only move via the creation point-buy
today; a later points-economy purchase path is ⬜ (see skills.md's Open questions).

### Races — modifiers, and the still-open "small race" problem 🟡 balance *(was P6/P7)*
Baseline **25** in all eight attributes, then each race shifts **two up by 5, two down by 5**
(net zero — every race is a lateral trade, not a power level). Each race is also going to carry
a **Size** tier (Small/Average/Large — a canid is roughly 2× an ermehn) and a handful of
signature **traits**, plus a movement rate — these are ⬜ **not built yet**; today only the
attribute modifiers exist in code.

| race | animal | +5 / +5 | −5 / −5 | Size 🟡 | Move 🟡 | signature niche (design intent, not yet mechanical) |
|---|---|---|---|---|---|---|
| `canid` | wolves | Strength, Willpower | Agility, Charisma | Large | 4 | militaristic Aisling; **Howl** (fear/alarm), **Fangs** |
| `ermehn` | stoats/ermines | Agility, Dexterity | Strength, Charisma | Average | 5 | stateless exiles; ambush, dagger-duelist, cold-hardened |
| `felis` | cats | Agility, Intelligence | Strength, Constitution | Average | 5 | Kishar scholars/urbanites; night eyes, claws, lithe |
| `lutren` | otters | Dexterity, Charisma | Strength, Willpower | Average | 3 land / 6 swim | Sunsgrove seafarers/traders; amphibious, nimble hands |
| `polcan` | marbled polecats | Strength, Constitution | Agility, Charisma | Average | 4 | stateless seaborne raiders; **only** bronze-smiths, sea-legs |
| `tamian` | red squirrels | Agility, Perception | Strength, Constitution | Small | 4 | Sunsgrove arboreal scouts; climber, Tesque footwork |
| `vulpin` | kit foxes | Charisma, Intelligence | Strength, Willpower | Average | 4 | Navran cosmopolitans/nomads; cunning, keen senses |

Size is meant to be one legible knob for the canon body gap (a canid is roughly 2× an
ermehn): **Large** → +Wounds, +carry, biggest weapons, but easier to hit; **Small** → −Wounds,
−carry, but harder to hit; Average → neutral (ties into combat.md's Wounds formula and a
not-yet-built to-hit-against modifier). **Move** sets Walk speed; Run is proposed as ×3 Move. Neither
Size nor Move is wired into any formula yet — see this file's Open questions.

**Open, unresolved tension (❓ — flag before balancing further):** only canid and polcan keep
+Strength; the other five races are all −Strength. That's the realistic size gap, but as-is it
risks funneling every small race into the same "finesse" lane. The proposed fix — light/finesse
weapons scale off **Agility Bonus** instead of Strength Bonus, so small races get a real melee
lane (daggers/rapiers) without needing +Strength — is designed in combat.md but not decided
(see that file's Open questions). Decide this **before** hand-authoring more weapon content: it
changes how five of seven races fight.

Felis and Vulpin deliberately share +Intelligence (they're canon scholar-rivals) but split on
the second stat, so they still don't play the same. Trait power across races is intentionally
*uneven* for v1 (Night Eyes/natural weapons plainly beat Sea-Legs) — accepted for now, revisit
only if one race dominates play.

Races can also carry **check affinities** on specific encounter options (not a blanket racial
stat) — e.g. a lutren's ×1.5 chance on a swim check. This is the mechanism, not a full trait
system; full racial traits (Howl, Fangs, Amphibious, Bronzeforged, …) are ⬜ not built.

### Creation — the two-layer contract ✅ direction
Per the pillar in [README.md](README.md): a new character should be playable from **race +
role + name** alone, with the bot filling in everything else from templates; manual point
allocation is the deep-layer opt-in. Today only the **attribute point-buy** exists as a manual
step (Roles/templates don't exist yet — skills.md) — so creation is currently *all* deep-layer
by necessity, not by design intent. Closing that gap (race/role templates that skip the point-
buy for a casual) is real future work, not yet an open fork with a number.

---

## Implementation

### Account — `db/models/account.ts` ✅
| Field | Type | Notes |
|---|---|---|
| `_id` | string | Discord user id |
| `username` | string | cached, refreshed on contact |
| `activeCharacterId` | string \| null | → `Character._id` |
| `settings.activeGame` | boolean | default **true** — opt-out from future ambient game events (D27; no consumer yet) |
| `settings.dmNotifications` | boolean | default **true** — gates bot DMs (consumed by the approval-verdict DM) |

Created bare on first contact (`accountService.getOrCreate`); `activeCharacterId` stays `null`
until `/character create` — no auto-starter, so `/profile` never shows a phantom draft.
Settings read through `accountSettings()` (defaults fill in for pre-D27 docs), flipped via
`accountService.updateSetting` (the `/profile` panel's toggle buttons).

An account owns up to **`MAX_CHARACTERS_PER_ACCOUNT = 3`** characters (`game/character/rules.ts`
— the only knob), all made explicitly via `/character create` (accounts start with none).

### Character — `db/models/character.ts` ✅ structure / 🟡 stats
| Field | Type | Status | Notes |
|---|---|---|---|
| `_id` | string (uuid) | ✅ | own key — NPCs have no account |
| `ownerId` | string \| null | ✅ | Account id, or `null` for NPC. Indexed |
| `approvalStatus` | `draft\|pending\|approved\|rejected` | ✅ | unapproved ⇒ can't take character-actions |
| `rejectionReason` | string? | ✅ | set on reject |
| `identity.{name,race,epithet,gender,bio,avatarUrl}` | — | ✅ | filled by the creation wizard |
| `locationId` | string | ✅ | → world-travel.md's `LocationId`, falls back on unknown |
| `resources` | {health,stamina}: {current,max} | 🟡 | shape real, values placeholder |
| `actionPoints` | {current, totalEarned} | ✅ rule / 🟡 rate | see world-travel.md |
| `attributes` | 8 × number | ✅ shape / 🟡 balance | **effective = racial base + allocation**; stored, recomputed on race/allocation change |
| `attributeAllocation` | 8 × number | ✅ | the creation point-buy (0–20 each, Σ = 50); kept separate so a race switch rebases cleanly |
| `traits` | 6 × number | ✅ shape | deed traits — see flavor-progression.md |
| `progression.skills` | sparse node map | ✅ shape / 🟡 content | see skills.md |
| `currencies` | 1 × number | ✅ per-character | see economy.md |
| `inventory`, `equipment` | — | ✅ | see items-equipment.md |

### Attributes & the creation point-buy — `game/data/attributes.ts`, `game/character/attributes.ts` ✅ D25
`ATTRIBUTE_BASE = 25`. Racial base = `ATTRIBUTE_BASE` shifted by the race's
`attributeModifiers` (net-zero ±5, test-enforced). The wizard's **required** attribute step
distributes `CREATION_ATTRIBUTE_POINTS = 50` points, `MAX_POINTS_PER_ATTRIBUTE = 20` on any
one attribute (both 🟡 tunable) — Submit is gated on spending every point.
`adjustAllocation` clamps partially (e.g. a `+5` click with 3 points left assigns 3). Stored
`attributes` = base + allocation; `attributeAllocation` is kept as its own field specifically
so a **mid-wizard race switch rebases** the same spend instead of corrupting it
(`characterService.setRace` recomputes atomically in-pipeline).

### Resources — `game/data/resources.ts` 🟡
The two vitals stored per character, each `{current, max}` clamped to `[0,max]`:

| key | name | defaultMax | regenPerHour | regenWhileBusy |
|---|---|---|---|---|
| `health` | Health | 20 | 2 | false |
| `stamina` | Stamina | 10 | 5 | false |

`regenWhileBusy: false` means the hourly regen job **skips** (not defers) these while a
character is in an active `ActivitySession` — you don't heal mid-climb or mid-duel. Action
Points are the deliberate exception: they always accrue even while busy (world-travel.md).
Rising meters (hunger, stress — flavor-progression.md's Stress) have inverted tick semantics
and aren't added yet. `max` is a stored default today, not derived from attributes — the
`recalculateMaxResources` seam (an attribute-driven max) is future work, kept as a deliberate
simplification so the regen/clamp pipelines stay simple now.

### Races — `game/data/races.ts` ✅ ids / 🟡 balance
`canid, ermehn, felis, lutren, polcan, tamian, vulpin`, each carrying only
`attributeModifiers` today (net-zero ±5, from the table above — a test enforces the net-zero
invariant). Size, Move, and signature traits (Howl, Fangs, Amphibious, Bronzeforged…) are ⬜
not in code yet. Check affinities live per encounter option, not on the race record — see
world-travel.md's travel encounters.

### Approval lifecycle — ✅ workflow
`draft → pending → approved / rejected`, all three transitions **status-guarded atomic
updates** (return `false` on a stale request, so a leftover decree message can't approve a
character that was since decided or re-edited). A player builds their **active** character on
the wizard panel while `draft`/`rejected` (`canEdit`); **Submit** (`canSubmit`: 2+ char name +
a race) flips it to `pending` and posts a petition (embed + Approve/Reject buttons) to the
owner-only `imperialDecrees` channel. The owner's verdict repaints the petition and DMs the
player (best-effort). `game/character/rules.ts → canCharacterAct(character, apCost)` gates
character-actions: requires `approved && health > 0 && actionPoints.current >= apCost`.
**Viewing** never uses this gate — a 0-HP or unapproved character can still be inspected.
First (and so far only) consumer: travel (world-travel.md).

### The creation wizard — ✅ D20
One ephemeral panel (`_characterPanel.ts`) driven by a step catalog
(`game/character/creationSteps.ts`): `{ id, kind: modal|select, required, isComplete,
summary }`. Current steps: `details` (modal — name 2–32, epithet ≤50, bio ≤1000, avatar URL
≤400), `race` (select, required), `gender` (select, required), `attributes` (select-kind step
view, required — the point-buy). **No stored wizard cursor** — the draft `Character` doc *is*
the state; progress is derived from which fields are filled, so the flow is interruptible and
resumable across restarts with nothing to desync. Adding a step = one catalog entry + one
renderer case.

### Character lifecycle commands — ✅ Phase 6B
`/character create|edit|view [user]|list|switch|race|submit`. `/profile` is the **account**
surface (D27): active character, character count, settings toggles. `/character view` is the
**character sheet**: status, race, location, AP, vitals, currencies, attributes, nonzero
traits, equipment.

### Active-character switching — ✅ session-aware
`accountService.setActiveCharacter` refuses while the current OR target character is **busy**
(in-memory locked, or in an active `ActivitySession` — this half survives restarts). 0-HP and
unapproved characters *can* be activated. This switch guard is what enforces "one user, one
live activity at a time"; the locks themselves are keyed per **character**, not per Discord
user (root `CLAUDE.md`'s concurrency model).

---

## Open questions

- **Strength scarcity / a finesse path** *(was P6)* — light/finesse weapons scaling off
  Agility instead of Strength, so the five −Strength races get a real melee lane. Proposed,
  not decided; affects combat.md's damage formula. Also unresolved together: what scales
  *ranged* damage (Perception? Dexterity? nothing, as today?).
- **Size tiers** *(was P7)* — Small/Average/Large touching Wounds, carry capacity, and
  to-hit-against. Owner: "leave that for later, too tricky without other rules for now."
- **Race signature traits** (Howl, Fangs, Amphibious, Bronzeforged, …) — direction only, no
  mechanical shape yet; costing them (so no race is strictly best) is an open question too.
- **Race/role creation templates** — closing the "casual never allocates a number" gap once
  Roles (skills.md) exist.
- Resource (`health`/`stamina`) max values, and whether max should ever derive from attributes
  (the `recalculateMaxResources` seam) instead of being a flat stored default.
