# World & Travel — locations, Action Points, living world, encounters

See [README.md](README.md) for the legend.

---

> **What is built:** [implementation/world-travel.md](implementation/world-travel.md). This file holds only the rules.

## Reference (decided data & math)

**Action Points** — `{current, totalEarned}`, **no cap**, `+AP_REGEN_PER_HOUR = 1`/hr (🟡),
accrue **even while busy**. Atomic `spendActionPoints` (filter-guarded `≥ cost`).
`TRAVEL_AP_COST = 0` 🟡; the first real spenders landed in S1: `FORAGE_AP_COST = 1` and
`EXAMINE_AP_COST = 1` (both 🟡, professions.md); other per-action costs undecided.

**Locations** (`game/data/locations.ts`) — undirected, test-validated graph; today
`spire ↔ plaza ↔ tavern`, `plaza ↔ riverbank ↔ tanglewood` (the Tanglewood joined in S1 as
the foraging woodland). Optional `climate`, `features` (discoverable), `baseStats`.
**`resourceNodes`** (✅ S1, professions.md) name a place's gather tables
(`game/data/resourceNodes.ts` — foraging live, fishing joins in S2).

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
worth having; the `/play` hub's local-action buttons (implementation/world-travel.md) are the intended
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
also **discover** a location feature. Since D40, every **rolled** option also trains its skill
path (learn-by-doing, weighted by how hard the roll was for that character — skills.md's
Reference formula); checkless choices train nothing.

### Unfinished activities — no clock, but always a way out ✅ built (D58)
A multi-step activity (a challenge on the road, a conversation) does **not** time out. The
character stays in it — and can do nothing else — until the player finishes it. Starting any
other action simply brings the unfinished step back.

Why no time limit: a deadline punishes the honest player whose connection dropped, and it
rewards the one who would rather wait out a bad situation than face it. With no deadline,
waiting gains nothing — Health does not even regenerate while the character is busy (Action
Points do).

Because nothing ends an activity for the player, **every step must offer a way out**, and
three rules bind it:

- **It is in character, and each activity writes its own.** Never "Cancel" or "Resign". At a
  fallen tree the character kicks the trunk and trudges back; a climber lets go and drops;
  in a conversation the character insults the other side and the talk is cut off; in a
  fight it is a surrender.
- **It is never better than the worst choice.** Walking on past a drowning stranger costs a
  point of Cowardice and gets you where you were going; backing away from the bank costs the
  same point and the journey too.
- **Its consequences land once, at that moment** — like every other consequence in an
  activity, which is saved at the step it happens and never held until the end.

Later, when an exit can cost Health: reaching 0 Health will carry penalties, never permanent
death (pillar 3). When an activity has several players (a card table, a manual duel), each
turn will need a short timer and a default move, because there someone else is waiting.

The owner can end a stuck activity by hand (`h!session`); that frees the character with no
consequence.

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

---

## Open questions

- **NPC seeding + movement** (root `CLAUDE.md`'s Phase 6C) — NPCs are `Character` docs with
  `ownerId: null`; nothing populates or moves them along the graph yet, so "who's standing
  here" is currently always players. **Now designed → npcs.md (R18)** (seeding script + hourly
  behavior CRON); this file just provides the graph they move on.
- **Location activity tables** — turning each `hubActions.ts` placeholder into a real activity
  (a catalog flip + one handler case each). **`forage` shipped as the first (S1)** and proved
  the pattern; fishing (S2, `resourceNodes`) and talk (conversations.md R14) are next.
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
