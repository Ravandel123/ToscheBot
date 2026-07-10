# NPCs — simulated characters

See [README.md](README.md) for the legend and the shared file shape.

An **NPC** is a `Character` with **no owner** (`ownerId: null` — character.md's Account↔Character
split, D12): the *same* model, same attributes/skills/inventory/location, just no Discord account
behind it. Per R18 they're populated by a **seeding script** and driven by an hourly **behavior
CRON** — they travel, work, fight, trade and can be talked to (conversations.md) or teamed with.
This is root `CLAUDE.md`'s **Phase 6C**, designed here.

---

## Reference (decided data & math)

**An NPC is** — a `Character { ownerId: null, approvalStatus: 'approved' }` whose **`_id` is
`npc-<npcId>`** (D44): the static half (role/epithet, home, archetype→future behavior) is NOT
stored on the doc — it resolves from `game/data/npcs.ts` via that id at read time (D10).
Dynamic per-NPC state (disposition, later) gets stored fields when built. Reuses every
character system for free (locks keyed by `Character._id` already handle NPCs, D18; presence
`atLocation` already includes them, D31).

**Simulation** — an hourly `npc-tick` CRON: each NPC performs **≤1 action** (🟡, "or less" — a
probability/energy gate keeps them from all acting every hour). Actions are chosen by the NPC's
`behavior` profile (data-driven, D10) filtered by the **condition language** (world-travel.md —
time of day, weather, location) so NPCs keep a rough schedule.

**Behavior profiles** (`game/data/npcBehaviors.ts`, ⬜) — a weighted action list per archetype:

| archetype | typical hourly actions |
|---|---|
| Wanderer | travel an edge; forage/fish; rest |
| Merchant | restock wares; return to home stall; (sell to players on contact) |
| Laborer (fisher/forager/farmer) | work their profession at a resource node (professions.md) |
| Guard/Soldier | patrol edges near home; challenge/fight hostiles |
| Homebody | idle at home; small talk |

**Relationship** — a bounded per-(NPC, character) `disposition` integer (gifts/help raise it,
theft/insults lower it), gating teaming and warmer dialogue. Distinct from **faction reputation**
(factions.md — org-level) and **deed traits** (flavor-progression.md — the character's own soul).

---

## Ruleset

### NPCs reuse the whole character stack ✅ direction R18
The load-bearing decision (already locked by D12/D18/D31): an NPC is not a special record, it's
a `Character` with `ownerId: null`. So NPCs already have attributes, skills, inventory,
location, currencies, health — and already lock, already show up in presence lists, already can
be a combatant. The *only* new thing an NPC needs is a **brain** (the behavior CRON) and a
**spawn** (the seeding script). Everything else is inherited. This is why the design is cheap.

### Seeding — a script, run by the Imperator ✅ BUILT (S2/D44)
The owner's ask: "a script that easily adds them to a new database." `scripts/seed-npcs.ts`
(`npm run seed-npcs`, confirmDb-guarded via `SEED_NPCS_CONFIRM_DB`; logic in `npcSeed.ts`,
db-tested) **idempotently upserts** the hand-authored roster (`game/data/npcs.ts` — name, race,
gender, epithet, home, archetype, starting gear/coins) so a fresh Atlas cluster (or a wipe) is
repopulated in one command. Idempotent by the stable NPC id (= the character id, D44):
re-running never duplicates — it **updates the static half only** (identity, race, home) and
never resets what the world has mutated (pack, coins, resources, progression — AUDIT §3.3).
Starting gear/coins are granted on CREATE only. NPC ids are append-only (D10). One v1 caveat:
a reseed repositions a re-homed NPC (nothing else can move one yet) — the day the npc-tick
cron lands, drift must win and that block in `npcSeed.ts` must be deleted.

### The behavior CRON — one action an hour ✅ direction (numbers 🟡)
An hourly `npc-tick` job (sibling of `resource-regen`, and **bulk-first / lock-aware** exactly
like it — root `CLAUDE.md`'s D7/D23): for each NPC, maybe pick one action from its behavior
profile and apply it as an atomic write. Because NPCs use the same lock manager, a player fighting
or trading with an NPC and the CRON moving that NPC can't corrupt each other (the tick defers or
skips a locked NPC, D18/D23). Keep each tick's work small and idempotent (a restart mid-sweep must
be safe) — the same discipline the resource-regen job already follows.

**Movement** makes the world feel alive: NPCs drift along the location graph, so "who's standing
at the plaza" (D31 presence) changes hour to hour without any player input — the single cheapest
way a ~10-person server stops feeling empty.

### What NPCs *do* for players ✅ direction (⬜ built)
- **Trade** — a Merchant NPC sells from its inventory and buys from you (economy.md's shop/haggle
  layer; the NPC's stock is just its `inventory`, restocked by the CRON). The first real
  currency sink/source.
- **Converse** — NPCs host dialogues (conversations.md): quests, lore, gated by disposition /
  faction rep / traits.
- **Team up temporarily** — an NPC can **join a player's side** for a while (a companion on a
  Side-A/Side-B combat — combat.md — and travel), then part ways. Bounded by disposition and
  time. This turns a lone async grind into "adventure with a buddy," which suits the setting's
  small cast.
- **Work autonomously** — a fisher NPC actually fishes, a farmer tends a plot (professions.md);
  their output can feed the economy (goods on a merchant's shelf came from a laborer NPC),
  making the world's economy partly self-driving.
- **Fight** — NPCs are combatants for PvE (combat.md's Trial mode), patrols, and the
  Smackdown Spire; a hostile NPC (a hated faction's guard) can even initiate — but **never into
  real losses against an offline player** (combat.md's consent rule; NPC aggression on a player
  resolves as a stakeless/escapable event unless the player opts in).

### Disposition & memory ✅ direction (numbers 🟡)
A small per-(NPC, character) **disposition** value (bounded, D32) remembers how an NPC feels
about *you specifically* — raised by gifts (tie to likes/dislikes — a gift they like counts
more), completed favors, shared victories; lowered by theft, failed Deceit, attacking them.
Gates teaming and dialogue warmth. Distinct from faction reputation (org-wide) — a Watch NPC can
personally like you while the Watch as a body distrusts your kind.

### Named characters vs generic extras ✅ direction
Two tiers: **hand-authored named NPCs** (Mearog the tavern gambler, a quest-giver captain —
persistent, memorable, quest-bearing) and **generic extras** (a nameless forager, a stall
vendor — populate presence, provide ambient trade/talk, cheap to author in bulk or even generate
procedurally). Ship a few named ones + a handful of generics per key location.

---

## Implementation

✅ **Step 1 is LIVE (S2/D44, 2026-07-10)** — the static roster:
- `game/data/npcs.ts` — 7 named NPCs (plaza merchant, tavernkeeper, spire guard, ferryman,
  herb-gatherer, old campaigner, wandering scholar) with archetype (data-only seam: nothing
  reads it until the S3 shop / the behavior cron), home, starting gear, and 🟡 starting coins
  (the plaza merchant's pool = the S3 shop's finite trading gold, per the owner's 2026-07-10
  call). Content integrity (lengths, carry weight vs racial strength, a merchant anchored at
  the plaza) is test-locked in `npcs.test.ts`.
- `characterService.createNpc` mints an approved `ownerId: null` character under the stable
  `npc-<npcId>` id — never through the wizard/approval flow (D13 vets players, not content);
  `npcDefinition(characterId)` resolves the static half back from the catalog (D10).
- `scripts/seed-npcs.ts` — the idempotent upsert (see Seeding above).
- NPCs already show in `/play` presence with an *(NPC)* tag — zero new runtime code, as
  designed.

Build order, remaining:
2. ⬜ `game/data/npcBehaviors.ts` + `jobs/npcTick.ts` — the hourly brain (start with just
   **movement**, the highest-impact/lowest-risk action), bulk-first & lock-aware per D23.
   **Blocked on the lifecycle decision** (PLAN Decision queue #7); when it lands, also flip
   `npcSeed.ts`'s reseed-repositions-home block (location becomes mutable state).
3. ⬜ Player-facing verbs, in demand order: **trade** (PLAN S3, needs economy.md's shop) →
   **conversation** (PLAN S4, conversations.md) → **teaming** (needs the Side-A/B combat
   engine, combat.md) → autonomous professions (needs professions.md).
4. ⬜ `disposition` (per-NPC-per-character) — add when teaming/gift content needs it; keep
   bounded (sparse-only from day one, AUDIT §3.3).

---

## Open questions

- **Tick budget on M0** — how many NPCs can an hourly bulk tick move within free-tier limits;
  "≤1 action/hour, or less" — the exact activity rate and whether NPCs have an energy/AP analog.
- **Behavior sophistication** — pure weighted-random per archetype (cheap, ship this) vs
  goal-driven (an NPC that seeks the cheapest bread, restocks when low) — start dumb, deepen if
  it's fun.
- **Procedural vs authored** — how many named NPCs to hand-write vs generate generics; whether
  generics persist or are ephemeral spawns.
- **NPC mortality** — no permanent death protects *players* (combat.md R8); do NPCs die/retire
  and get reseeded, or also just get Downed? Probably NPCs *can* be removed/replaced (the seed
  script re-populates), but decide before combat kills anything.
- **Disposition vs reputation vs traits** — keep the three axes legibly separate for content
  authors (see factions.md's same concern).
- **Teaming rules** — how long a companion stays, whether they take a share of loot/AP, how
  their actions are surfaced to the player (auto-narrated on the player's side).
- **Economy coupling** — how self-driving to make it: do laborer NPCs *actually* generate the
  goods merchants sell (a real supply chain), or is stock just abstractly restocked? The former
  is delightful and risky (price/stock spirals); gate it behind the economy layer.

---

## Expansion ideas & risks

**Risks:**
- **Per-(NPC, character) disposition is a cross-product, not a bounded list.** Unlike deed traits
  or reputation (bounded by a fixed catalog size), disposition scales with **NPC count × player
  count** — dozens of NPCs × several characters per player adds up. Needs a hard bound from day
  one: either only store disposition for NPCs a character has actually interacted with (sparse,
  same shape as skill progression — naturally self-limiting since most NPCs never get touched),
  or cap total tracked relationships per character and let the oldest/weakest decay out.
- **A self-driving economy chain can silently break** — if a laborer NPC's node stops producing
  (a bug, a bad tick) and a merchant's stock is genuinely sourced from it, players discover an
  empty, confusing shop with no obvious cause. Recommend the hand-authored fallback floor
  (README's cross-cutting risk) explicitly: a merchant's stock should have a minimum baseline
  that never depends on the simulation succeeding.
- **Named NPCs vs generic extras needs a clear line early** — without one, every generic filler
  NPC risks slowly accreting bespoke dialogue/behavior until there's no meaningful distinction
  left, defeating the point of having a cheap tier at all.

**Expansion ideas:**
- **Rumor propagation between connected NPCs** — a small per-tick chance that two NPCs who are
  near each other (or connected by the location graph) sync a piece of gossip about a player
  (a notable deed, a reputation swing) — cheap (reuses the existing hourly tick), and organically
  makes "your reputation precedes you" feel alive across the map without any new player-facing UI.
- **NPCs as passive quest-flag witnesses** — an NPC standing at a location during a notable
  encounter/challenge outcome could "remember" it happened (a lightweight flag, not a full
  disposition change) and reference it in later dialogue, making the world feel like it's
  actually watching, at very low storage cost.
- **A "hire" verb distinct from teaming** — beyond temporary companionship, a Merchant or Laborer
  NPC could be *hired* for a standing service (a bodyguard escort for one trip, a cook retained at
  a tavern) — same underlying infrastructure as teaming, framed as a small economy sink
  (economy.md) rather than a combat companion.
