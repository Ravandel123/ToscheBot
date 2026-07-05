# Character — Account, Character, attributes, races, creation

See [README.md](README.md) for the legend and how this file is structured.

---

## Reference (decided data & math)

**Account** (`db/models/account.ts`) — one per Discord user; **server-wide, not game-only** (R19).

| field | default | note |
|---|---|---|
| `_id` | — | Discord user id |
| `activeCharacterId` | null | → `Character._id` |
| `settings.activeGame` | true | opt-out from future ambient game events |
| `settings.dmNotifications` | true | gates bot DMs (approval verdict) |
| `settings.units` | `metric` | `metric`\|`imperial` — **DB is always metric**, imperial is computed on display (R19) ✅ |
| `settings.country` | null | player's country (server flavor/roleplay) ✅ |
| `settings.timezone` | null | IANA zone; affects server + game time features (R19) ✅ *(stored/validated; game clock still uses a fixed offset)* |

**Attributes** — 8, base **25**, roll-under; effective = **racial base + creation allocation +
XP-bought raises (R13)**. Strength · Constitution · Agility · Dexterity · Charisma · Willpower ·
Perception · Intelligence (what each governs: Ruleset table below).

**Creation point-buy** — `CREATION_ATTRIBUTE_POINTS = 50`, `MAX_POINTS_PER_ATTRIBUTE = 20` (🟡).

**Races** — baseline 25, each **+5/+5 · −5/−5** (net zero); table in Ruleset. **Size tier
dropped (R20)** — body is derived from weight/height, not a race tier.

**Body & condition** (R20): frame (`body.{weightKg,heightCm,age}`) **✅ built** (metric, race
defaults + a creation step); derived shape/move **✅ built**; the rest ⬜ not built:

| field | stored? | note |
|---|---|---|
| `body.weightKg` | metric ✅ | set at creation (race-default midpoint), editable on the Frame step |
| `body.heightCm` | metric ✅ | set at creation, editable |
| `bodyShape` | **derived** ✅ | from weight/height (BMI band: gaunt/lean/average/stocky/heavy) — `game/character/body.ts` |
| `body.age` | yes ✅ | stored + shown (young/prime/old band); stat curve 🟡 **not wired** |
| `moveSpeed` | **derived** ✅ | race base Move + Agility bonus (`game/character/body.ts`); encumbrance/injury 🟡 not yet |
| `physicalState[]` | ⬜ | injuries, sicknesses, notable physical details |
| `mentalState[]` | ⬜ | addictions, traumas, fears (the psychological counterpart) |
| `preferences` | ⬜ | **likes/dislikes**: food, music, race, faction |

**Health** — a single intuitive **Health-points pool + hit locations** (R12), replacing the old
low "Wounds" pool. Concentrated damage to one location forces a critical injury there. See
combat.md.

**Fate points** — small pool (proposed **2**): reroll a failed check, or shrug off a knockout
(R21). See combat.md.

**Stress → insanity points** (R21) — a rising Stress bar; maxing it grants insanity points that
risk a lasting mental disadvantage, removable only by special treatment. See flavor-progression.md.

**Racial signature talents** (R22, ⬜) — each race carries always-on trait(s) auto-applied to
every relevant check/combat (a lutren's Amphibious = swim affinity **and** more), never something
the player must remember to invoke.

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
| **Constitution** *(was "Toughness")* | soak, wounds, resistance to disease/poison/fatigue |
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

**Attributes rise indirectly — skill-gated, XP-bought ✅ direction R13.** Attributes do **not**
rise from mere use like skills do (that would make grinding one skill silently pump its whole
attribute). Instead the owner's model: using skills tied to an attribute **unlocks the ability to
buy that attribute up with XP**. Train Athletics/Melee (Strength/Agility-rooted) enough, and the
character panel opens a "+Strength / +Agility" option — but **only** the attributes actually fed
by the skills you've been raising; each raise costs experience points. This makes attribute
growth *earned through relevant activity* (a blacksmith gets stronger, a scholar sharper) and
directly answers the "attribute double-dip" warning below by **gating** the purchase, not just
pricing it. The engine + XP economy live in **skills.md** (R13); this file just records that
`attributeAllocation` is no longer the *only* growth path.

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
| `felis` | manul cats | Agility, Intelligence | Strength, Constitution | Average | 5 | Kishar scholars/urbanites; night eyes, claws, lithe |
| `lutren` | otters | Dexterity, Charisma | Strength, Willpower | Average | 3 land / 6 swim | Sunsgrove seafarers/traders; amphibious, nimble hands |
| `polcan` | marbled polecats | Strength, Constitution | Agility, Charisma | Average | 4 | stateless seaborne raiders; **only** bronze-smiths, sea-legs, **Dogged** (stubborn endurance) |
| `tamian` | red squirrels | Agility, Perception | Strength, Constitution | Small | 4 | Sunsgrove arboreal scouts; climber, Tesque footwork |
| `vulpin` | kit foxes | Charisma, Intelligence | Strength, Willpower | Average | 4 | Navran cosmopolitans/nomads; cunning, keen senses |

**Size tier is dropped (R20).** The old plan was a Small/Average/Large racial tier as one knob for
the canon body gap (a canid is ~2× an ermehn). The owner's call: **derive the body from
`weight`/`height` instead** (below) — a canid simply *has* a bigger frame, so "size" falls out of
concrete numbers rather than a separate enum. The `Size` column above is kept only to show the
intended *relative* frames as authoring guidance for each race's default weight/height ranges;
it is **not** a stored field and feeds no formula. Whatever Size used to modify (carry, biggest
weapons, easier/harder to hit, the health pool) now reads off body/weight and Strength.
**Move** still sets Walk speed (Run proposed ×3 Move) and now **feeds the derived `moveSpeed`**
(✅ built: race base Move + Agility bonus — the per-race Move values live in `game/data/body.ts`'s
`RACE_BODY`, not the catalog table above). Encumbrance/injury terms are 🟡 not yet in it.

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

### Account is server-wide, and carries units / country / timezone ✅ direction R19
The account is the **player**, not a game object — its settings affect normal server use, not
just the RPG (this is why settings live on `Account`, not `Character` — D27). Three new settings:
- **Units** (`metric` | `imperial`, default `metric`). **The database always stores metric**
  (kg, cm, °C); when a player picks Imperial the bot **computes the imperial display on the fly**
  (the `lib/units.ts` converters the fun commands already use). One canonical stored unit, zero
  drift, per-player presentation — the correct split.
- **Country** — a player's country, for server flavor/roleplay (and a sensible default timezone).
- **Timezone** — affects **server-wide** time features (timestamps, event timing) *and* the
  game clock's per-player feel, not only the game. The game clock currently runs on one fixed
  owner offset (world-travel.md); a per-player timezone is a later refinement of that.

### Body & condition — weight, height, shape, age ✅ built R20 *(frame + derived shape/move)*
A character is described by concrete body numbers, not an abstract tier. **Built:** `body.{weightKg,
heightCm,age}` stored metric (`game/data/body.ts` catalog + `game/character/body.ts` pure logic),
a race-default frame at creation + an optional **Frame** wizard step to tweak it, and derived
body-shape + move speed shown on `/character view` in the viewer's units:
- **Weight** (kg) and **height** (cm) are set at creation (race-default midpoint of the
  `RACE_BODY` ranges) and editable on the Frame step. Both stored **metric** (units setting handles
  display).
- **Body shape** is **derived** from weight ÷ height (a BMI band with in-world names —
  gaunt / lean / average / stocky / heavy, `BODY_SHAPE_BANDS`). Not chosen, not stored: a
  read-time label, so it can never disagree with the numbers.
- **Age** is stored + shown with a young/prime/old band. Its **stat curve is 🟡 not wired** yet
  (D14 stance — structure now, mechanics later): the young haven't filled out
  (slightly lower Strength/Constitution, maybe faster skill growth), the old trade physical
  attributes for mental ones (−Agility/+Intelligence-ish). One legible curve, not a per-year sim.
- Body feeds **carry capacity** (with Strength — items-equipment.md), **movement speed** (below),
  the **health pool** (combat.md R12 reads off frame/Constitution, replacing Size), and which
  gear/weapons plausibly fit.

### Physical & mental state ✅ direction R20 (⬜ built)
Two lists of ongoing **conditions** a character carries, distinct from momentary combat
Conditions (combat.md):
- **Physical state** — injuries (a limp, a notched ear — the scar idea in flavor-progression.md),
  **sicknesses** (a fever slows you; cured by Herbalism/Medicine — professions.md/skills.md), and
  notable physical details. Sourced by combat (going Downed leaves a scar/injury), the world
  (disease, cold), and bad forage (professions.md's misidentification).
- **Mental state** — **addictions** (the tavern's bottle — flavor-progression.md's vice),
  **traumas** and **fears** (the lasting side of Stress→Madness), tics and quirks. Sourced by
  Stress/insanity (below) and story.

Both are the "texture" the setting wants (flavor-progression.md R9) and both must stay
**auto-managed for casuals** (the bot narrates a limp; it never makes you micromanage one).
They're the durable counterpart to combat.md's transient Conditions.

### Movement speed ✅ built R20 (formula 🟡, no consumer yet)
A derived `moveSpeed` (`game/character/body.ts`) = race base **Move** + an Agility bonus. Shown on
`/character view`. 🟡 The **encumbrance** penalty (pack weight vs carry capacity —
items-equipment.md) and body/injury terms aren't in the formula yet, and nothing *consumes*
moveSpeed (travel pacing, chase/flee opposed tests — combat.md — are future). Derived, never
stored, so it always reflects current attributes.

### Likes & dislikes ✅ direction R20 (⬜ built)
A character has **preferences** — liked/disliked **food** (professions.md cooking: a matched dish
heals/relieves Stress *more*, a disliked one backfires), **music**, **race**, and **faction**.
This is the character's *own* feelings — distinct from deed traits (who they're becoming) and
faction reputation (how others see them). Small mechanical weight (cooking benefit, NPC gift
value — npcs.md, a dialogue color) plus a lot of cheap roleplay texture. Chosen at creation
(a light optional wizard step) or emergent.

### Racial signature talents ✅ direction R22 (⬜ built)
Beyond the ±5 attribute modifiers, each race carries **always-on signature trait(s)** that the
engine applies automatically wherever relevant — the owner's ask: "decide how to implement those
to always be taken into account when doing checks/combat, like better swimming for lutrens, could
be a flat bonus to swimming or something more interesting, or both." Decision: **both** — a
signature talent may add a **check affinity** (the existing per-check race multiplier — a lutren's
×1.5 swim, world-travel.md) *and/or* a **special effect** (a canid's **Howl** causing Fear/Stress;
tamian **Tesque footwork** aiding Climb/Dodge; felis **Night Eyes** negating darkness penalties;
polcan **Bronzeforged** enabling bronze-smithing). Implemented as a small per-race talent list
consulted by the check/combat engines, so it's never something the player must remember to
"turn on." Costing them so no race is strictly best is the open balance question (below).

### Health, Fate, Stress — pointers
- **Health** is now a single intuitive **Health-points pool with hit locations** (R12) — the old
  low "Wounds" pool is dropped as confusing. Full design in **combat.md**.
- **Fate points** (reroll a failed check / dodge a knockout) — **combat.md** (R21).
- **Stress → insanity points** (a stress bar; overflow risks a lasting mental disadvantage,
  removable only by treatment) — **flavor-progression.md** (R21), feeding `mentalState` above.

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
| `settings.units` | `'metric'\|'imperial'` | ✅ R19 — default `metric`; **DB always metric**, imperial computed on display (consumed by `/character view`'s body) |
| `settings.country` | string \| null | ✅ R19 — player's country (free text) |
| `settings.timezone` | string \| null | ✅ R19 — IANA zone, validated on set; game clock still uses a fixed offset |

Created bare on first contact (`accountService.getOrCreate`); `activeCharacterId` stays `null`
until `/character create` — no auto-starter, so `/profile` never shows a phantom draft.
Settings read through `accountSettings()` (defaults fill in for pre-D27 docs). Boolean settings
flip via the `/profile` toggle buttons; `units` cycles metric⇄imperial; `country`/`timezone` open
a text modal — all through the generic `accountService.updateSetting<K>(userId, key, value)`.

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
| `body` | {heightCm, weightKg, age} | ✅ R20 | metric frame; shape + moveSpeed derived (`game/character/body.ts`); age curve 🟡 |
| `traits` | 6 × number | ✅ shape | deed traits — see flavor-progression.md |
| `progression.skills` | sparse node map | ✅ shape / 🟡 content | see skills.md |
| `currencies` | 1 × number | ✅ per-character | see economy.md |
| `inventory`, `equipment` | — | ✅ | see items-equipment.md |
| `health` (pool + locations) | — | ⬜ R12 | replaces the low Wounds pool — see combat.md |
| `body.{weightKg,heightCm}` | number (kg/cm) | ✅ R20 | metric; `bodyShape`/`moveSpeed` derived, not stored |
| `body.age` | number | ✅ R20 | stored + shown; young/prime/old stat curve 🟡 not wired |
| `physicalState[]`, `mentalState[]` | — | ⬜ R20 | ongoing injuries/sicknesses / addictions/traumas/fears |
| `preferences` | — | ⬜ R20 | likes/dislikes: food, music, race, faction |
| `reputation` | sparse map | ⬜ R15 | per-faction standing — see factions.md |
| `xp` + attribute-raise unlocks | — | ⬜ R13 | skill-gated XP economy — see skills.md |
| `fatePoints` | number | ⬜ R21 | reroll / dodge knockout — see combat.md |
| `stress` (+ insanity) | — | ⬜ R21 | see flavor-progression.md |
| `questFlags` / NPC `disposition` | — | ⬜ | conversation memory — see conversations.md / npcs.md |

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
simplification so the regen/clamp pipelines stay simple now. **R12 reframes `health`** into a
larger, intuitive pool with per-location tracking (combat.md); when built, its `max` derives from
frame (weight/height) + Constitution (replacing the dropped Size term) — the
`recalculateMaxResources` seam is exactly where that computation lands.

### Races — `game/data/races.ts` ✅ ids / 🟡 balance
`canid, ermehn, felis, lutren, polcan, tamian, vulpin`, each carrying `attributeModifiers` on the
race record (net-zero ±5, from the table above — a test enforces the net-zero invariant). Their
frame ranges + base **Move** live in `game/data/body.ts`'s `RACE_BODY` (✅ — feeds default frame +
`moveSpeed`). Size (the enum) is dropped (R20); signature traits (Howl, Fangs, Amphibious,
Bronzeforged…) are ⬜ not in code yet. Check affinities live per encounter option, not on the race
record — see world-travel.md's travel encounters.

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
≤400), `race` (select, required), `gender` (select, required), `body` (modal — the **Frame**
step, R20: height/weight/age, optional and pre-filled with the race default), `attributes`
(select-kind step view, required — the point-buy). **No stored wizard cursor** — the draft
`Character` doc *is* the state; progress is derived from which fields are filled, so the flow is
interruptible and resumable across restarts with nothing to desync. Adding a step = one catalog
entry + one renderer case (or a modal builder for modal steps).

### Character lifecycle commands — ✅ Phase 6B / R19 / R20 / D34
`/character create|view [user]|list|skills|switch`. `/profile` is the **account** surface
(D27/R19): active character, character count, boolean setting toggles, **units** (metric⇄imperial
cycle), and **country/timezone** (modal — timezone IANA-validated). `/character view` is the
**character sheet**: status, race, location, AP, vitals, currencies, **body** (frame/shape/age/
move — shown in the *viewer's* units, R19), attributes, nonzero traits, equipment. **`/character
skills`** (R20 note: owner put skills under `/character`) opens the read-only **skill panel** (D34,
`_skillPanel.ts` + the `charskills` component handler): every tree root with trained points →
drill into one tree to see per-node points, the Effective a check would roll, and progress toward
the next point. *(New subcommand ⇒ a `npm run deploy` re-registration is required.)*

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
- **~~Size tiers~~ → resolved & built (R20):** Size enum dropped; weight/height → derived
  body-shape is **built** (`game/data/body.ts` `RACE_BODY` ranges + `BODY_SHAPE_BANDS`). The
  *numbers* (per-race ranges, band thresholds) are 🟡 placeholders open to tuning.
- **Age curves** *(R20)* — age is **stored + shown** (with a young/prime/old band); the **stat
  curve is not wired** — how much young/prime/old shift stats, and whether age advances in play
  (real-time? never?) or is purely a creation choice, is still open.
- **Movement-speed formula** *(R20)* — `moveSpeed` is **built** as race Move + Agility bonus; the
  **encumbrance/injury terms are 🟡 not in it yet**, and **nothing consumes it** (travel pacing,
  chase/flee opposed tests, initiative are future).
- **Racial signature talents** *(R22)* — the per-race list and each one's shape (pure check
  affinity vs a special effect vs both), and **costing them so no race is strictly best**
  (trait power is intentionally uneven for v1 — accepted until one race dominates).
- **XP / attribute-raise economy** *(R13)* — where XP comes from, the cost curve of an attribute
  raise, and how "only attributes fed by skills you've trained" is computed and surfaced in the
  panel. Full design belongs to skills.md.
- **Likes/dislikes** *(R20)* — how many axes (food/music/race/faction — more?), how much
  mechanical weight (cooking/NPC-gift benefit) vs pure roleplay, chosen-at-creation vs emergent.
- **Units/country/timezone** *(R19)* — **built** on the `/profile` panel (units cycle;
  country/timezone modals, timezone IANA-validated); units drives `/character view`'s body display.
  Still open: wiring the per-player **timezone into the game clock** (it still uses a single fixed
  offset — world-travel.md), and whether country should do anything mechanical.
- **Physical/mental state model** *(R20)* — the concrete shape of the two condition lists (bounded
  catalogs, D32), their sources (combat/disease/Stress/forage), and how they auto-manage for
  casuals; heavy overlap with flavor-progression.md's scars/vice/Stress — design them together.
- **Race/role creation templates** — closing the "casual never allocates a number" gap once
  Roles (skills.md) exist.
- Resource (`health`/`stamina`) max values, and whether `health` max derives from frame +
  Constitution (R12) via the `recalculateMaxResources` seam.

---

## Expansion ideas & risks

**Risks:**
- **Creation-wizard bloat.** R20 alone adds weight/height/age/preferences on top of the existing
  identity+race+gender+attribute steps. If each becomes a mandatory manual field, character
  creation gets long before a casual ever presses Submit — the exact failure mode pillar 6 warns
  against. Recommend: weight/height/age get a **sensible race-based random default** the player
  can accept with one click or tweak manually; only likes/dislikes stay a genuine (optional)
  choice, since defaults there would be meaningless.
- **XP-gated attribute raises can trap a build (R13).** If only attributes fed by *already-
  trained* skills unlock, a character who happened to specialize early (all Charisma-branch
  skills, say) can **never** unlock Strength — there's no valid path to "try something new"
  short of literally starting to train Strength-rooted skills from zero at their *current*
  Effective disadvantage. This is fine as friction but could feel like a wall, not a choice, if
  there's no in-fiction way to explain it. Consider a rare, costly "training montage" one-time
  partial re-open (a quest reward, not a shop item) as a release valve — see skills.md.
- **Physical/mental state as unbounded free-form lists** — `physicalState[]`/`mentalState[]`
  need a hard catalog (D10/D32) or they'll grow into an unbounded per-character array exactly
  like the old `gFishing.fish[]` CLAUDE.md warns against. Treat entries as references to a fixed
  catalog of conditions (a scar type, a named Disorder), never free text.

**Expansion ideas:**
- **Body feeds gear fit, not just flavor.** Once weight/height exist, a character's frame could
  gate which armor/weapon sizes fit (items-equipment.md) — a tamian in canid-sized plate is a
  funny and mechanically real image, not just a stat. Cheap: one attribute-requirement-style
  check against a size band derived from weight/height.
- **Age as a slow narrative clock**, not just a stat modifier — an old character could unlock
  "veteran" dialogue options (conversations.md) or a mentor role toward younger characters,
  giving age a social payoff beyond a small stat curve.
- **A generated "character legend" blurb** — once deed traits, reputation, and titles exist, the
  bot could periodically compose a one-paragraph in-character summary of who a character has
  become (Tosche's voice, flavor-only per R6) from the existing fields — a free narrative
  reward for all the bookkeeping these systems already do, no new mechanical surface.
