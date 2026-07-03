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

_Last updated: 2026-07-03 (game foundations D20–D24: creation wizard, location graph +
`/travel` + encounters, activity registry + `obstacle`, busy-split regen, chronicle)._

---

## Big picture

- ✅ **Account** = a Discord user. **Character** = an in-game entity (player-controlled or
  NPC). One account owns characters and controls one **active character** at a time.
- ✅ NPC = a Character with `ownerId: null` (movement/AI later, Phase 6C).
- ✅ Currencies and Smackdown ELO are **per character**.
- ✅ Character **creation, editing, and approval** — a step-driven **wizard panel** (D20)
  over `/character …` + owner Approve/Reject — Phase 6B.
- ✅ **Travel** along the location graph (`/travel`, D21) with a **travel-encounter seam**
  (flavor lines or interactive obstacles) — the first `canCharacterAct` + AP consumer.
- ✅ **Durable interactive activities** (D17/D22): registry-dispatched, crash-safe;
  first activity: `obstacle` (🟡 pure-random placeholder mechanics).
- ✅ **Chronicle**: gameplay is ephemeral; noteworthy outcomes go to a public log channel (D24).
- 🟡 Attributes, skills, resource values, combat formula, AP regen rate, travel/obstacle
  numbers — placeholders.
- ⬜ NPC seeding + movement (6C), the actual RPG ruleset (Phase 7).

An account owns up to **`MAX_CHARACTERS_PER_ACCOUNT = 3`** characters (one auto-starter
draft + up to two more via `/character create`); the constant lives in
`game/character/rules.ts` and is the only knob.

---

## Entities (MongoDB)

### Account — `db/models/account.ts` ✅
| Field | Type | Notes |
|---|---|---|
| `_id` | string | Discord user id |
| `username` | string | cached, refreshed on contact |
| `activeCharacterId` | string \| null | → `Character._id` |
| `createdAt`/`updatedAt` | Date | timestamps |

Created on first contact by `accountService.getOrCreate`, which also creates a starter
**draft** character and sets it active.

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
| `attributes` | 9 × number | 🟡 | placeholder, all 10 |
| `skills` | 6 × {level,progress} | 🟡 | placeholder, level 1 |
| `currencies` | 1 × number | ✅ per-character | `deltradaCoins`, start 0 (D19) |

### SmackdownRecord — `db/models/smackdownRecord.ts` ✅
Keyed by `Character._id`. `{ characterName, eloRating (default 1000), wins, losses }`.
`characterName` is denormalized so the leaderboard needs no join.

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

### Attributes — `game/data/attributes.ts` 🟡 placeholder
`strength, toughness, agility, dexterity, perception, intelligence, willpower, charisma,
luck` — all default **10**. No mechanics consume them yet except the placeholder combat
formula.

### Skills — `game/data/skills.ts` 🟡 placeholder
General: `cooking, fishing, swimming`. Weapon: `melee, ranged, unarmed`. Each `{level:1,
progress:0}`.

### Currencies — `game/data/currencies.ts` ✅ (per-character)
**One currency: `deltradaCoins`** — starts 0, clamped `>= 0`. The lore's regional per-race
currencies (amber drops, pearl flakes, obsidian chips…) return **with** the exchange/trade
economy layer (`RPG/` P17), not before — D19: append a currency when it means something;
never park six empty wallets.

### Races — `game/data/races.ts` ✅
`canid, ermehn, felis, lutren, polcan, tamian, vulpin` (flavour only; no racial mechanics).

### Locations — `game/data/locations.ts` ✅ graph / 🟡 content
`spire` (start) ↔ `plaza` ↔ `tavern`, `plaza` ↔ `riverbank`. The `connectedTo` graph is
**undirected and test-enforced** (`game/world/travel.test.ts`: every edge exists, is listed
on both ends, no self-loops — a bad edit fails `npm test`). A location MAY carry a
`channelId`. Not Discord channels by default. Stale stored ids resolve to the starting
location (`resolveLocationId`, D10 rule 3). The location set itself is placeholder content.

### Travel encounters — `game/data/encounters.ts` 🟡 placeholder content, ✅ seam (D21)
Rolled on each `/travel` move (`TRAVEL_ENCOUNTER_CHANCE_PERCENT = 25`, weighted pick from
the pool eligible for the destination; `locations: [...ids] | 'anywhere'`). Two kinds:
- **`flavor`** — instant: a random line is appended to the arrival message + chronicle. The
  move completes normally. (`patrol_gossip`, `dropped_ribbon`)
- **`activity`** — interrupts the move with a durable ActivitySession of `activityType`;
  the character arrives **only if the activity succeeds**. (`fallen_tree` → `obstacle`)
Outcomes with real mechanics (damage, loot) wait for the Phase 7 ruleset (D14).

---

## Rules

### Action Points (AP) — ✅ rule, 🟡 rate
- **No cap.** Accumulate via the hourly regen `$inc` (`current` and `totalEarned`) — and
  they accrue **even while the character is busy** in an activity (D23).
- Spent only through `characterService.spendActionPoints(id, cost)` — atomic
  check-and-spend (filter requires `current >= cost`; can't overdraw under concurrency).
- Regen rate is a placeholder (`AP_REGEN_PER_HOUR = 1`).
- Consumers: ✅ `/travel` goes through the spend path with `TRAVEL_AP_COST = 0` (🟡 a
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
  requires `approved && health > 0 && actionPoints.current >= apCost`. **Viewing** (`/profile`,
  inventory) never uses this gate; a 0-HP character can be active and inspected, just can't
  act. ✅ **First consumer: `/travel`** — unapproved characters can't roam. Sparring stays
  deliberately ungated (D16); the serious duel (Phase 7) is next.

### Character lifecycle commands — ✅ (Phase 6B, wizard since D20)
`/character` subcommands:
- `create` → a text **modal** (name required) makes a new draft (capped at
  `MAX_CHARACTERS_PER_ACCOUNT`, set active) and lands on the **wizard panel**.
- `edit` → opens the **wizard panel** for the active draft (this is also how an
  interrupted creation is **resumed** — any time, even after a bot restart).
- `list` → your characters + status + active marker.
- `switch` → autocomplete → change active character.
- `race` / `submit` → still work as standalone shortcuts, but the panel covers both.

The **creation wizard** (D20) is one ephemeral panel driven by the **step catalog**
`game/character/creationSteps.ts` — currently `details` (modal: name required 2–32, epithet
≤50, bio ≤1000, avatar URL ≤400), `race` (select, required), `gender` (select, optional,
`GENDER_CHOICES`). The panel's **overview** shows a ✅/⬜ checklist with per-step summaries,
a **step picker** (jump to and redo ANY step while editable), **Continue** (jumps to the
first unfinished step) and **Submit** (enabled once every *required* step is done —
`canSubmit` reads the catalog). Select-kind steps open a focused **step view** (that step's
dropdown + Back); modal-kind steps open their modal directly. An avatar URL renders as the
embed **thumbnail** (also on `/profile` and the petition).

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

### Travel — ✅ (D21; numbers 🟡)
`/travel destination:<autocomplete of connected locations>` moves the **active** character
along the graph. Flow (whole decision under `runExclusive([characterId])`, reply deferred
first): re-check busy (an active session **re-enters** — re-renders its current step instead
of erroring) → `canCharacterAct(character, TRAVEL_AP_COST)` → edge check (`game/world/
travel.ts → checkTravel`, stale origins fall back to start) → atomic AP spend → encounter
roll → either `setLocation` + arrival reply (+ flavor line) or an interrupting activity
session (see below). Replies are ephemeral; arrivals/outcomes go to the **chronicle** (D24).
Autocomplete is read-only (`peekActiveCharacter` — no account creation per keystroke).

### Durable activities — ✅ scaffold + registry + first consumer (D17/D22)
Long, interactive, multi-step activities (turn-based duel, obstacles, exploration) are made
**crash-/restart-safe** by persisting state per step instead of holding it in memory:
- **`ActivitySession`** (`db/models/activitySession.ts`): `{ type: duel\|exploration\|obstacle,
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

#### The `obstacle` activity — ✅ pattern / 🟡 mechanics (first consumer)
Spawned by an `activity` travel encounter (e.g. `fallen_tree`). State (`game/activity/
obstacle.ts`, pure + tested): `{ encounterId, fromId, toId, progress, setbacks, lastLine }`.
Each **Attempt** click = one pure-random roll (`OBSTACLE_SUCCESS_PERCENT = 55` 🟡, no stats —
the D16 sparring precedent) committed via `advance`; `progress ≥ 2` ⇒ **cleared** (character
`setLocation`s to the destination), `setbacks ≥ 3` ⇒ **forced back** (stays at origin);
**Turn back** = clean cancel (`abandon`, refund seam); timeout ⇒ TTL reap ⇒ stays at origin,
no side effect needed. Outcomes are chronicled. **Crash-safe completion:** the terminal
outcome is *derived from state*, the final `advance` doubles as the completion mutex, side
effects (move, chronicle, delete) are idempotent, and if the bot dies mid-tail, `render`
shows a "Press on" **finalize** button that re-runs it. This file is the reference pattern
for the future duel/NPC-talk/exploration handlers.

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
cleanliness, toughness. `maxHp = str*5 + wp*5 + tou*10`. **Placeholder** — at base stats
everyone is identical, so sparring is effectively random. Real numbers wait on the ruleset.

### Duel — ⬜ (serious tier)
Future `/smackdown duel`: requires **approved** characters, uses real HP/attributes,
**costs AP**, persists outcomes. Designed in Phase 7.

---

## Services (where state changes)

- `accountService` — getOrCreate (race-safe starter claim), getActiveCharacter,
  peekActiveCharacter (read-only — viewing someone / autocomplete must not create their
  account), setActiveCharacter (busy-aware: locks + active sessions).
- `characterService` — get, getOwned, countOwned, create, createStarter, remove,
  updateIdentity, setRace, submitForApproval/approve/reject (status-guarded, return
  false on a stale transition), applyResourceDeltas (clamp [0,max]), applyCurrencyDeltas
  (clamp ≥0), spendActionPoints (atomic), setLocation, regenAll/regenAllBusy/regen
  (the D23 busy split).
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

- What attributes/skills actually exist and what they *do* (the current sets are
  placeholders to be reconsidered).
- Attribute allocation at character creation (point-buy?) and caps — will become new
  wizard steps in the D20 catalog when designed.
- Real combat math (hit/damage/initiative), max-HP / regen formulas from attributes.
- AP costs per action (travel currently 0; the spend path is wired); whether AP ever
  needs a cap.
- Obstacle/encounter resolution: replace the pure-random `OBSTACLE_SUCCESS_PERCENT` roll
  with real checks (stats/skills), add stakes (damage, loot) and richer encounter tables
  per location/edge.
- Economy: how currencies are earned/spent; per-character wallets interactions.
- Locations: full map, travel costs, what NPCs do there (per-location activity tables).
