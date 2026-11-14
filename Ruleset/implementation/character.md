# Character — implementation

What exists in `src/` today for the rules in [character.md](../character.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

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
| `resources` | {health,stamina}: {current,max} | ✅ formula / 🟡 numbers | `max` is attribute-derived (D39) — see Resources below |
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
| `stress` (+ insanity) | — | ⬜ R21 | rising pressure; **Sanity** (overall mental health) = `MENTAL_MAX − stress`, derived not stored — see flavor-progression.md |
| `questFlags` / NPC `disposition` | — | ⬜ | conversation memory — see conversations.md / npcs.md |

### Attributes & the creation point-buy — `game/data/attributes.ts`, `game/character/attributes.ts` ✅ D25
`ATTRIBUTE_BASE = 25`. Racial base = `ATTRIBUTE_BASE` shifted by the race's
`attributeModifiers` (net-zero ±5, test-enforced). The wizard's **required** attribute step
distributes `CREATION_ATTRIBUTE_POINTS = 50` points, `MAX_POINTS_PER_ATTRIBUTE = 20` on any
one attribute (both 🟡 tunable) — Submit is gated on spending every point.
`adjustAllocation` clamps partially (e.g. a `+5` click with 3 points left assigns 3). Stored
`attributes` = base + allocation; `attributeAllocation` is kept as its own field specifically
so a **mid-wizard race switch rebases** the same spend instead of corrupting it
(`characterService.setRace` re-reads the doc, recomputes attributes + resource maxes, and
writes both in one `$set`).

### Resources — `game/data/resources.ts` + `game/character/resources.ts` ✅ formula built / 🟡 numbers
The two vitals stored per character, each `{current, max}` clamped to `[0,max]`:

| key | name | regenPerHour | regenWhileBusy | max formula (D39, see Formulas) |
|---|---|---|---|---|
| `health` | Health | 2 | false | `12 + ConBonus·2 + StrBonus·1 + WilBonus·1` |
| `stamina` | Stamina | 5 | false | `4 + ConBonus·2 + WilBonus·1` |

`regenWhileBusy: false` means the hourly regen job **skips** (not defers) these while a
character is in an active `ActivitySession` — you don't heal mid-climb or mid-duel. Action
Points are the deliberate exception: they always accrue even while busy (world-travel.md).
Rising meters (hunger, stress — flavor-progression.md's Stress) have inverted tick semantics
and aren't added yet. **`max` is attribute-derived (D39, built 2026-07-07)** — `game/character/
resources.ts`'s `recalculateMaxResources` computes it from the character's current `attributes`;
`defaultCharacterStats` seeds a fresh character full at that value, and `characterService.setRace`/
`setAttributeAllocation` recompute + reapply it (`applyMaxResources`: full stays full on a raised
cap, a damaged character keeps its current wounds under a new ceiling) whenever attributes
change. `RESOURCES`' `defaultMax` field is now just the reference value at neutral (25-in-
everything) attributes, kept for display/tuning context, not read by the live formula. **R12
reframes `health`** into a larger, intuitive pool with per-location tracking (combat.md); when
built, add a **Frame addend** (weight/height, replacing the dropped Size term) to `healthMax` —
the same `recalculateMaxResources` function, one more term, no migration.

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
