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

_Last updated: 2026-06-15 (Phase 6B: character lifecycle + approval commands landed)._

---

## Big picture

- ✅ **Account** = a Discord user. **Character** = an in-game entity (player-controlled or
  NPC). One account owns characters and controls one **active character** at a time.
- ✅ NPC = a Character with `ownerId: null` (movement/AI later, Phase 6C).
- ✅ Currencies and Smackdown ELO are **per character**.
- ✅ Character **creation, editing, and approval** commands (`/character …` + owner
  Approve/Reject) — Phase 6B.
- 🟡 Attributes, skills, resource values, combat formula, AP regen rate — placeholders.
- ⬜ Locations graph + NPC movement (6C), the actual RPG ruleset (Phase 7).

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
| `currencies` | 6 × number | ✅ per-character | start 0 |

### SmackdownRecord — `db/models/smackdownRecord.ts` ✅
Keyed by `Character._id`. `{ characterName, eloRating (default 1000), wins, losses }`.
`characterName` is denormalized so the leaderboard needs no join.

---

## Catalogs (content in code — D10)

### Resources — `game/data/resources.ts` 🟡
| key | name | defaultMax | regenPerHour |
|---|---|---|---|
| `health` | Health | 20 | 2 |
| `stamina` | Stamina | 10 | 5 |
Stored per character as `{current, max}`, clamped to `[0,max]` on every write. Rising
meters (hunger/stress) — ⬜ not added yet.

### Attributes — `game/data/attributes.ts` 🟡 placeholder
`strength, toughness, agility, dexterity, perception, intelligence, willpower, charisma,
luck` — all default **10**. No mechanics consume them yet except the placeholder combat
formula.

### Skills — `game/data/skills.ts` 🟡 placeholder
General: `cooking, fishing, swimming`. Weapon: `melee, ranged, unarmed`. Each `{level:1,
progress:0}`.

### Currencies — `game/data/currencies.ts` ✅ (per-character)
`amberDrops, pearlFlakes, obsidianChips, silverCoins, goldCoins, deltradaCoins` — start 0,
clamped `>= 0`.

### Races — `game/data/races.ts` ✅
`canid, ermehn, felis, lutren, polcan, tamian, vulpin` (flavour only; no racial mechanics).

### Locations — `game/data/locations.ts` 🟡 placeholder
`spire` (start), `plaza`, `tavern`, with a `connectedTo` graph for future travel. A
location MAY carry a `channelId`. Not Discord channels by default.

---

## Rules

### Action Points (AP) — ✅ rule, 🟡 rate
- **No cap.** Accumulate via the hourly regen `$inc` (`current` and `totalEarned`).
- Spent only through `characterService.spendActionPoints(id, cost)` — atomic
  check-and-spend (filter requires `current >= cost`; can't overdraw under concurrency).
- Regen rate is a placeholder (`AP_REGEN_PER_HOUR = 1`).
- Consumers: ⬜ none yet (serious combat/travel in 6C/7 will cost AP).

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
- `game/character/rules.ts → canCharacterAct(character, apCost)` gates *character actions*:
  requires `approved && health > 0 && actionPoints.current >= apCost`. **Viewing** (`/profile`,
  inventory) never uses this gate; a 0-HP character can be active and inspected, just can't
  act. ⬜ **Nothing gates on `canCharacterAct` yet** — sparring is ungated (D16); travel/duel
  (6C/7) are its first consumers.

### Character lifecycle commands — ✅ (Phase 6B)
`/character` subcommands:
- `create` → a text **modal** (name required) makes a new draft (capped at
  `MAX_CHARACTERS_PER_ACCOUNT`, set active) and lands on the **panel**.
- `edit` → opens the **panel** for the active draft.
- `list` → your characters + status + active marker.
- `switch` → autocomplete → change active character.
- `race` / `submit` → still work as standalone shortcuts, but the panel covers both.

The **creation panel** (`commands/components/_characterPanel.ts`) is one ephemeral message
combining what Discord splits across two surfaces: **race + gender dropdowns** (selects only
live on messages) + an **Edit details** button (free text only lives in a modal: name,
epithet, short description, avatar URL) + a **Submit** button (disabled until name+race set).
An avatar URL renders as the embed **thumbnail** (also on `/profile` and the petition). The
panel re-renders in place after each step and is **stateless** — the character id rides in the
customIds and the state is the DB draft, so it survives restarts (no collector; matches the
`comic` browser pattern). Identity limits (`game/character/identity.ts`): name 2–32, epithet
≤50, bio ≤1000, avatar URL ≤400; gender is a fixed pick (`GENDER_CHOICES`).

### Active-character switching — ✅ service + command
`/character switch` → `accountService.setActiveCharacter(userId, username, characterId,
locks)`: only your own character; blocked if the current OR target character is locked
(mid-fight/activity, via `PlayerLockManager.isLocked`). 0-HP / unapproved characters *can*
be activated.

### Hourly regen — ✅
`jobs/resourceRegen.ts` → `characterService.regenAll(excludeIds)` bulk-updates all
characters not currently locked (one pipeline `updateMany`), then defers a single-character
`regen` for each locked one (D7). Resources clamp to max; AP just grows.

### Durable activities — ✅ scaffold / ⬜ consumers (D17)
Long, interactive, multi-step activities (turn-based duel, multi-room exploration) are made
**crash-/restart-safe** by persisting state per step instead of holding it in memory:
- **`ActivitySession`** (`db/models/activitySession.ts`): `{ type, participantIds, step,
  status: active\|completed\|abandoned, state (opaque blob), expiresAt }`. It's both the saved
  state *and* the cross-restart "this character is busy" lock.
- **`activitySessionService.advance(id, expectedStep, state)`** is a step-guarded atomic
  update → each step is idempotent against double-clicks and crash-replay.
- Components carry the `sessionId` (stateless), so buttons survive a restart.
- A **TTL index** on `expiresAt` (refreshed each step) auto-reaps idle/abandoned sessions.
- **AP policy (default, tunable):** charged at start; clean cancel refunds; **timeout/abandon
  forfeits** (a TTL delete then needs no side effect).
- 🟡 `state` shape, the AP costs, and the actual step logic belong to each activity — **not
  built yet** (blocked on the ruleset, D14). Pure timing helpers in `game/activity/session.ts`.
First consumers: the serious `/smackdown duel` and 6C `travel`. Short auto-resolved actions
(sparring) do **not** use this — they commit atomically (D5 rule 1).

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

- `accountService` — getOrCreate, getActiveCharacter, setActiveCharacter.
- `characterService` — get, getOwned, countOwned, create, createStarter, updateIdentity,
  setRace, submitForApproval, approve, reject, applyResourceDeltas (clamp [0,max]),
  applyCurrencyDeltas (clamp ≥0), spendActionPoints (atomic), setLocation, regenAll/regen.
- `smackdownService` — getOrCreate, recordResult (Elo), getLeaderboard.
- `activitySessionService` — create, getActiveForParticipant, advance (step-guarded),
  complete, abandon. The durability layer for long activities (D17) — see below.

All character writes go through services; commands stay thin. Discord buttons/selects/modals
are handled by `commands/components/*` (keyed by customId namespace) — `character.ts` owns the
create/edit/approve/reject flows; `_`-prefixed siblings build the embeds + modals.

---

## Open questions / TBD (Phase 7 ruleset — design with owner before coding)

- What attributes/skills actually exist and what they *do* (the current sets are
  placeholders to be reconsidered).
- Attribute allocation at character creation (point-buy?) and caps.
- Real combat math (hit/damage/initiative), max-HP / regen formulas from attributes.
- AP costs per action; whether AP ever needs a cap.
- Economy: how currencies are earned/spent; per-character wallets interactions.
- Locations: full map, travel costs, what NPCs do there.
