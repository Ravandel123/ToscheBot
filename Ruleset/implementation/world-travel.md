# World & Travel — implementation

What exists in `src/` today for the rules in [world-travel.md](../world-travel.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

### Action Points — `characterService.spendActionPoints` ✅ rule / 🟡 rate
`actionPoints: {current, totalEarned}`, no cap. `regenAll`/`regenAllBusy`/`regen` (the hourly
`resource-regen` job) `$inc` both fields — and AP accrues **even while a character is busy** in
an active `ActivitySession` (unlike the vitals, which pause — flavor-progression.md doesn't
cover this, it's a resource-regen rule: see root `CLAUDE.md`'s D23). Spend is atomic
(`current >= cost` filter-guarded, so it can never go negative under concurrency).
`AP_REGEN_PER_HOUR = 1` and `TRAVEL_AP_COST = 0` are both 🟡 placeholders — the spend
*plumbing* is real, the *prices* aren't decided.

### Locations — `game/data/locations.ts` ✅ graph / 🟡 content
`spire` (start) ↔ `plaza` ↔ `tavern`, `plaza` ↔ `riverbank`. `connectedTo` is **undirected and
test-enforced** (`travel.test.ts`: every edge exists on both ends, no self-loops, no dangling
target — a bad edit fails `npm test`). A location may declare `climate` (weather-weight
overrides), `features` (discoverable points of interest, hidden until found), and `baseStats`
(danger/prosperity starting values) — all optional and test-validated. A stale stored
`locationId` (e.g. after a content rename) resolves to the starting location rather than
crashing.

### Living state — `db/models/locationState.ts` + `locationStateService` ✅ D31
One doc per location, created **lazily on first read** (`getFresh`) — no seeding step needed.
`{ weather: {kind, since, until}, events: [{eventId, startedAt, endsAt}],
discoveredFeatureIds: string[], stats: Record<string, number>, visits: number }`. Weather
re-rolls via a **filter-guarded** update once `until` lapses (only one concurrent request wins
the re-roll); events are swept (removed) on read past `endsAt` and started via a guarded
`tryStartEvent` (same one-winner-among-concurrent-arrivals shape); `discoveredFeatureIds` is
server-wide (`$addToSet`, chronicled once); `stats` is a plain object keyed by
`LOCATION_STATS` (`danger`, `prosperity`) so **adding a stat needs no migration**; `adjustStat`
is the clamped write seam (⬜ nothing drives it yet — no event/outcome writes a stat delta in
play today).

**Presence is deliberately not stored anywhere** — `characterService.atLocation` is an indexed
query over `Character.locationId` (approved characters, active or benched, plus every NPC;
drafts aren't in the world). One source of truth, nothing to drift under concurrent moves.

### The game clock & conditions — `game/world/{time,conditions}.ts` ✅ D31
`timeOfDay()` maps the real clock (a fixed `GAME_UTC_OFFSET_HOURS`) to `morning/day/evening/
night`. `LocationCondition = { timeOfDay?, weather?, duringEvent?, requiresDiscovery?,
minTraits? }`, evaluated by `evaluateCondition(condition, worldContext(state, character))`,
returning a short player-facing reason on failure ("only during the evening or night"). Used
by hub-action availability (+ `hidden` for undiscovered secrets), encounter `conditions`, and
event start conditions. `minTraits` is the first thing in the whole codebase that reads deed
traits (flavor-progression.md) — e.g. a plaza NPC only greets a character with `empathy ≥ 1`.

### Weather & location events — `game/data/{weather,locationEvents}.ts` ✅ shape / 🟡 content
Weather kinds: `clear, overcast, rain, storm, fog`, each with a name/emoji/hub line/duration/
default roll weight. Location events ship three: `market_day` (plaza, daylight), `bards_night`
(tavern, evening/night — unlocks a `listen` hub action), `garrison_drill` (spire, daylight).
Both are pure flavor + condition-gating today; neither has a mechanical effect on checks yet.

### Travel flow — `commands/components/_playPanel.ts` + `_hubView.ts` ✅ D21/D30/D31
Travel is a **`/play` hub action** (the standalone `/travel` command was folded in — D30), not
a separate command. The hub shows the location's weather/time/danger·prosperity line, running
events, and **who is standing there** (players + NPCs); its "Travel to…" select lists connected
locations. Picking one, under the character's lock: re-check busy (an active session
**re-enters** its current step instead of erroring) → `canCharacterAct(character,
TRAVEL_AP_COST)` → edge check (`game/world/travel.ts`) → atomic AP spend → read the
destination's live `LocationState` → roll a conditional encounter (chance biased by the
destination's danger stat) → either arrive (`setLocation` + `recordVisit` + possible feature
discovery/event start + re-render the hub) or hand off to an interrupting `challenge` activity
session (below). Local-action buttons on the hub are filtered by `availability` at render *and*
re-validated at click time (a panel can go stale: the character may have moved, night may have
fallen).

### Travel encounters — `game/data/encounters.ts` ✅ model / 🟡 content
Rolled per move: `TRAVEL_ENCOUNTER_CHANCE_PERCENT + destination danger`, weighted pick among
encounters eligible for that destination (`locations: [...ids] | 'anywhere'`, optionally gated
by the shared `conditions` language). Two kinds:
- **`flavor`** — a random line appended to the arrival message + chronicle; the move completes
  normally (`patrol_gossip`, `dropped_ribbon`, and the conditional `soaked_traveler` /
  `grateful_beggar`).
- **`activity`** — interrupts the move with a durable **`challenge`** `ActivitySession`
  (root `CLAUDE.md`'s D17/D22 durability infrastructure — session-per-step, crash-safe,
  restart-proof buttons) exposing several `options`, each either a d100 `CheckDefinition`
  (combat.md) with `success`/`failure` outcomes, or a check-free choice. An outcome
  (`ChallengeOutcome`) is `result` (`proceed` completes the journey / `turn-back` ends it at
  the origin / `retry` costs a **setback**, forcing a retreat once `maxSetbacks` is hit) +
  flavor lines + optional trait deltas + an optional feature discovery. `oneShot` options
  retire after one failure. Current content: `fallen_tree` (climb Agility / heave Strength /
  search Perception, one-shot) and `drowning_stranger` (riverbank: swim Agility+Swimming —
  lutren ×1.5 — for +courage/+empathy; find a branch via Perception; or walk on, free, for
  +cowardice; the night-only variant `reed_glimmer` discovers the riverbank's hidden jetty).
  Per-option check targets are computed once, at session creation, and **stored in the session
  state** — so a repainted panel's shown odds and the actually-rolled odds can never disagree.
  The generic `activity` component router + the `_activities/` handler registry (root
  `CLAUDE.md` D22) dispatch `challenge` sessions; `game/activity/challenge.ts` holds the pure,
  tested step-reducer. Every ending (arrival, forced retreat, the encounter's exit) re-renders
  the `/play` hub at wherever the character ends up.
- **The exit (D58)** — every `ActivityEncounter` carries a required `exit: ActivityExit`
  (`game/activity/exit.ts`: label, emoji, lines, optional trait deltas). The handler's
  `retreat` action removes the session first (`activitySessionService.abandon` returns true
  only for the call that removed it) and applies the exit's traits only then, so a double
  click charges once; a stale exit button on an already-won crossing finishes the crossing
  instead. Sessions have no expiry (`activityExit.flow.test.ts`).

### The chronicle — `game/chronicle.ts` ✅ D24
`postChronicle(client, line)` posts short, never-pinging lines to `settings.channels.chronicle`
(best-effort — a missing channel logs a warning and never fails the action). Used today by
travel arrivals and encounter/challenge outcomes.

### Hub local actions — `game/data/hubActions.ts` ✅ four live
Live: **`forage`** (riverbank, Tanglewood — professions.md), **`talk`** (anywhere —
conversations.md), **`arena`** (the Spire — combat.md) and **`market`** (the plaza —
economy.md). The catalog marks liveness by OMITTING `comingSoon`; each live action has one
entry in `HUB_EXECUTORS` in the `play` component. Actions that still carry a `comingSoon`
line (tavern drink and gambling, fishing, the court…) stay in the catalog and are **not shown**
to players (D53).

### Hub shortcuts ✅ *(D59)*
The hub's last button row repaints the same message into one of the character's own panels:
Pack, Skills, Fighting style (`play:open:<panel>` → the same builders `/inventory`,
`/character skills` and `/character combat` use). Each of those panels' top views carries
"Back to /play" (`play:hub`, `_backToPlay.ts`), which repaints the hub — also when the panel
was opened by its slash command. `/play` is the one command a player has to know.
