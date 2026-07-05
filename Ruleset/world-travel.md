# World & Travel — locations, Action Points, living world, encounters

See [README.md](README.md) for the legend.

---

## Reference (decided data & math)

**Action Points** — `{current, totalEarned}`, **no cap**, `+AP_REGEN_PER_HOUR = 1`/hr (🟡),
accrue **even while busy**. Atomic `spendActionPoints` (filter-guarded `≥ cost`).
`TRAVEL_AP_COST = 0` 🟡; other per-action costs undecided.

**Locations** (`game/data/locations.ts`) — undirected, test-validated graph; today
`spire ↔ plaza ↔ tavern`, `plaza ↔ riverbank`. Optional `climate`, `features` (discoverable),
`baseStats`. **`resourceNodes`** (⬜, professions.md) name a place's fishing/forage/plot tables.

**LocationState** (`db/models/locationState.ts`, D31) — one lazy doc/location:
`weather{kind,since,until}`, `events[]`, server-wide `discoveredFeatureIds[]`,
`stats{danger,prosperity}` (`adjustStat` seam), `visits`.

**Presence** — never stored; `characterService.atLocation` queries `Character.locationId`
(approved players + NPCs). NPC movement (npcs.md) makes it change hourly.

**Game clock & conditions** (`world/{time,conditions}.ts`) — `timeOfDay` = morning/day/evening/
night on `GAME_UTC_OFFSET_HOURS`. `LocationCondition{ timeOfDay?, weather?, duringEvent?,
requiresDiscovery?, minTraits? }` gates hub actions / encounters / event starts.

**Travel encounter** — chance = `TRAVEL_ENCOUNTER_CHANCE_PERCENT + destination danger` (🟡).
Kinds: `flavor` (line + move) · `activity` (durable **challenge** session). **Conversations
(R14) are a third encounter payload** — a `dialogue` session (conversations.md).

**Chronicle** (`game/chronicle.ts`) — best-effort in-character lines to
`settings.channels.chronicle`; never pings, never fails the action.

---

## Ruleset

### Action Points — the async heartbeat ✅ shape / 🟡 numbers
The server is persistent and asynchronous — nobody is "at the table." Risky/meaningful
actions cost **Action Points (AP)**. A character gains **1 AP per real hour**, and AP
**never caps**: go away for a week, come back to a week's worth to spend in a day. No
daily-login pressure by design — this is meant to stay fun, not become a chore. Trivial/social
actions are free or cheap; exact AP costs per action are still 🟡.

### Bot-run exploration + Imperator-authored content ✅ R6
The world is run by the **bot** for routine flow (travel → search → encounter) and by the
**Imperator** (the owner, as admin) for hand-authored quests and rewards. The AI persona
(Tosch) is **flavor/narration only** and never decides outcomes — dice and rules decide, AI
describes on top. This keeps results fair, testable and cheap, and uses the AI only where it
shines.

### Travel and the location graph ✅ D21
Locations form a graph; moving along an edge is the first thing that spends AP and requires an
**approved** character (character.md's approval lifecycle). Each location should eventually
have its **own things to do** — a design constraint, not yet fully realized: a tavern implies
gambling/rest, a plaza implies market/gossip, a training ground implies duels, a riverbank
implies its own fishing table. A location that's just "a button that renames a string" isn't
worth having; the `/play` hub's local-action buttons (Implementation, below) are the intended
surface for this, but almost all of them are still placeholders.

### Living locations ✅ direction D31
Each location should feel alive, not static: **weather** that changes over time (and can be
biased by a location's climate — a riverbank sees more fog/rain), **running events** that
switch on for a few hours (a market day, a bard's night), **server-wide discoverable features**
(a scout finds a hidden jetty, and from then on everyone can reach it — a shared discovery, not
a per-character one, which fits a small ~10-person co-op server better), and simple **stats**
like danger/prosperity that color both the mood and the mechanics (higher danger → more travel
encounters). **Presence** ("who's standing at the plaza right now") should always be *derived*
from where characters actually are, never separately stored — there is nothing to keep in sync
if there's only one source of truth for a character's location.

### The game clock & a shared condition language ✅ direction D31
A simple time-of-day cycle (morning/day/evening/night, tied to the owner's real timezone) plus
one small, reusable way to say "this only applies when X" — time of day, current weather, a
running event, a prior discovery, or a character's deed-trait threshold
(flavor-progression.md). The same condition language should gate hub actions ("the market is
closed at night"), encounters ("a reed glimmers only after dark"), and event starts, so
authoring one new conditional thing is one data entry, not a new code path each time.

### Travel encounters — multi-approach challenges ✅ model D26 *(was P-challenges)*
An encounter on the road is **not one fixed check**. It should expose several **approaches**
and let the player pick a *key*: a skill/attribute test (force a door with Strength, pick it
with Dexterity, talk your way past with Charisma), or a **bypass** via an item (a rope
trivializes a climb), a talent, or a trait/role/reputation. The bot should show the
approaches a character can plausibly try and **auto-pick the best one for a casual**; hidden
approaches (a secret lever, a weak wall) are revealed by Perception or relevant skills — the
rewarding deep-layer surprise.

**The load-bearing lever is friction**: each attempt should cost AP, and **failure must have
consequences** (a forced door breaks; a botched approach can force a retreat; some options are
one-shot). Without that friction, a player would brute-force every option for free, and the
choice stops mattering. Outcomes may also move deed traits (flavor-progression.md) — diving in
after a drowning stranger vs walking on is the canonical example, and either resolution can
also **discover** a location feature.

### The chronicle ✅ D24
Gameplay itself should stay **ephemeral** (only the acting player sees their own journey step
by step), but outcomes worth an audience — arrivals, cleared/failed encounters, future duels —
should post a short in-character line to a public log channel. This keeps game channels from
being spammed by solo play while still giving the server a shared "what's happening in the
world" feed.

### What the new systems hook into the world ✅ direction (cross-refs)
This batch of design changes lands its gameplay *here*, in the world/hub — the world is the stage
the other files perform on:
- **Conversations (R14, conversations.md)** are a **third encounter payload** beside `flavor` and
  `activity`: an `activity`-shaped `dialogue` session. NPCs standing on the hub's presence list
  become **talk targets**, and an encounter can *start* a conversation on the road.
- **NPCs (R18, npcs.md)** populate presence and move hourly along this same graph, so "who's
  standing here" finally changes without a player acting. NPC movement reuses the location graph +
  `spendActionPoints`-style discipline; merchant NPCs make a location a **shop** (economy.md).
- **Professions (R16, professions.md)** attach to locations via **`resourceNodes`**: a riverbank's
  fish table, a woodland's forage table, a plot for gardening. The hub's placeholder local-action
  buttons (`hubActions.ts`) are exactly where forage/fish/tend become real (a catalog flip + one
  handler — the long-promised "each location has its own things to do").
- **Living-location stats finally get drivers** — professions harvest and NPC/event activity are
  the `adjustStat` callers that were missing (danger/prosperity actually move), and weather can
  bias profession + encounter tables (a storm churns rarer fish, hides forage).
- **AP costs** — travel is a placeholder 0; foraging/fishing/crafting/talking-with-a-check are the
  first real AP sinks to price (still 🟡).

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
  tested step-reducer. Every ending (arrival, forced retreat, a clean "Turn back") re-renders
  the `/play` hub at wherever the character ends up.

### The chronicle — `game/chronicle.ts` ✅ D24
`postChronicle(client, line)` posts short, never-pinging lines to `settings.channels.chronicle`
(best-effort — a missing channel logs a warning and never fails the action). Used today by
travel arrivals and encounter/challenge outcomes.

### Hub local actions — `game/data/hubActions.ts` ✅ scaffold / ⬜ content
Every button is a placeholder today (clicking shows an in-character "coming soon" line; the hub
stays up) — the catalog (`id, label, emoji, locations filter, comingSoon line`) exists and is
test-validated against `LOCATIONS`, but no location's activity table (tavern gambling, plaza
market, spire duels, riverbank fishing…) is actually built yet.

---

## Open questions

- **NPC seeding + movement** (root `CLAUDE.md`'s Phase 6C) — NPCs are `Character` docs with
  `ownerId: null`; nothing populates or moves them along the graph yet, so "who's standing
  here" is currently always players. **Now designed → npcs.md (R18)** (seeding script + hourly
  behavior CRON); this file just provides the graph they move on.
- **Location activity tables** — turning each `hubActions.ts` placeholder into a real activity
  (a catalog flip + one handler case each) is the concrete next step per the design constraint
  above. **The first real ones are designed → professions.md (R16)** (forage/fish/tend via
  `resourceNodes`) and conversations.md (R14) (talk to an NPC).
- **World-state drivers** — what actually nudges `danger`/`prosperity` (`adjustStat` has no
  caller yet), weather-modified check difficulty, per-character (not just server-wide)
  discoveries, more weathers/events/features, event-driven encounter pools.
- **Encounter stakes** — real damage/loot on challenge outcomes; richer per-location/per-edge
  tables beyond the two prototypes.
- **AP costs per action** — travel is wired at a placeholder 0; nothing else spends AP yet;
  whether AP ever needs a cap after all (currently: no).
- **Ambient/random events** — the account-level `activeGame` opt-out flag (character.md) has no
  consumer yet; this is its natural home (root `CLAUDE.md`'s backlog "Ambient events" idea).

---

## Expansion ideas & risks

**Risks:**
- **Hub button overload as systems land.** The `/play` hub is the single surface where travel,
  local actions, NPC presence/talk, and (once built) profession gather-buttons all converge. Each
  addition is individually cheap (a catalog entry), but the hub screen itself has a real ceiling
  on how many buttons/selects it can show before it stops being "a simple screen" (README pillar
  6) — see the cross-cutting risk in README.md. Worth budgeting hub real estate explicitly once
  professions + NPC talk both want a button at the same location.
- **`adjustStat` (danger/prosperity) has no driver yet, and several new systems assume one.**
  NPCs (patrols reducing danger), factions (a faction's local strength), and professions
  (over-harvesting depleting a node) are all plausible future callers — deciding which one writes
  first, and whether they can conflict (an NPC patrol lowering danger while a faction raid raises
  it) is worth thinking through before multiple uncoordinated callers exist.

**Expansion ideas:**
- **Weather as a genuine mechanical modifier**, not just flavor — a storm reducing visibility
  (Perception checks), rain hindering Fire-based crafting, could give the already-built weather
  system (D31) real teeth instead of only coloring hub text and travel-encounter chance.
  Currently ⬜ (this file's "World-state drivers" question already flags this).
- **A "notable location" ticker** — once discoveries (`discoveredFeatureIds`) and events exist
  in volume, a lightweight periodic chronicle post ("the jetty at the riverbank has been
  discovered!") is basically free narrative reuse of infrastructure that already exists (D24's
  chronicle), turning quiet backend state changes into visible server moments.
