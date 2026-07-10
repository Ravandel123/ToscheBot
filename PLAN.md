# PLAN.md — the build queue (session-sized briefs)

Created 2026-07-10 with the owner. This is the ordered work queue for Claude Code sessions;
it complements `CLAUDE.md` (conventions + status) and `Ruleset/` (game design). The 2026-07-06
audit's build-order advice (AUDIT §3) is baked into the ordering.

**The reasoning behind the order:** combat and skills went *wide* (D35–D42) while the game
still has no peaceful core loop — no way to gather anything (the only loot source is the
owner-run `/item grant`), no way to earn or spend a single coin, nobody to meet, and every
`/play` hub action is a placeholder. The queue below builds that loop **engine-first**:
each session ships a small reusable engine plus minimal content, so widening later is a
catalog edit, not a refactor (D10 discipline). Sessions S1–S4 need **no new owner
decisions** — everything they build is already designed in `Ruleset/` (professions R16,
npcs R18, economy's flat-price shop). Things that DO need the owner's call are parked in
the **Decision queue** at the bottom, deliberately out of the session path.

## How to run a session

Start a fresh Claude Code session with:

> Przeczytaj CLAUDE.md i PLAN.md. Wykonaj sesję S<N> zgodnie z jej briefem i "Session rules".

One session = one brief. If a session finishes early, take items from **Fillers**, not from
the next brief.

## Session rules (apply to every session)

1. **Read the linked `Ruleset/` file(s) before coding** and update their Implementation
   sections in the same change. New mechanics follow the design written there — do not invent.
2. **Engine/content split (D10)**: mechanics once, content as catalog entries; adding an
   entry must never need a migration or a new handler.
3. **All new numbers are 🟡** until the owner signs off. When balance isn't obvious, simulate
   (the D42 pattern) and report the distribution in the session summary.
4. **Never resolve an open design fork silently.** Build a typed seam around it and add the
   fork to the Decision queue below.
5. **Definition of done**: `npm run build` + `npm run lint` + `npm test` green; new logic
   tested (pure > db > flow, per CLAUDE.md's testing layers); a 1–3-line decision-log row in
   CLAUDE.md if a rule was set; CLAUDE.md's Status section updated; **flag here if a slash
   definition changed** (the owner runs `npm run deploy` — sessions never deploy).
6. **Close the loop here**: mark the session ✅ in the Log with the date + 2 lines on any
   divergence; append discovered follow-ups to Fillers or the Decision queue.

## Pending ops (owner, ~5 min)

- [ ] `npm run deploy` — pending slash changes: `/character combat`, `/smackdown` (trial
      browser), `/stash` (new command), `/leaderboard` (categories).
- [ ] A live end-to-end smoke against Atlas (`.env` + real guild) still hasn't been run —
      after S1 it should include one `forage` click and one Examine on the find.

---

## The queue

### S1 — Gathering engine + Foraging v1 · [M] · SAFE · ✅ 2026-07-10
**Design**: `Ruleset/professions.md` (R16 — the shared gather loop + identification),
`Ruleset/skills.md` (D40 crediting), AUDIT §3.1.
**Why first**: converts three built-but-idle engines (skills, checks, items) into the first
peaceful loop and the first real loot source; professions.md's own build order says foraging
first because it exercises the two novelties (identification, quality-from-check) that
fishing/cooking then reuse.
**Build**:
- `resourceNodes` on the location catalog (static field; ids test-validated like edges).
- A **generic gather resolver** (pure, `game/professions/gather.ts`): spend AP (cost 🟡) →
  d100 check vs node difficulty with race affinity → yield where **quantity scales with SL**
  and **per-instance quality comes from check surplus** (shared `qualityFromCheck` helper —
  smithing will reuse it) → grant to pack (encumbrance-checked) → `creditSkillUse`
  (difficulty weight, D40) → chronicle only rare finds. A gather is a **short action**
  (D5 rule 1) under the character lock — NOT an ActivitySession.
- Foraging skill tree (root + Identify leaf per the R16 table) — catalog only, zero migration.
- `game/data/foragables.ts`: ~6–10 `material` items + per-family descriptor pools.
- **Identification (R16)**: instance fields `identified` / `apparentItemId` / `descriptorId`
  (optional ⇒ no migration); auto-identify vs skill on gather; a failed identify may
  **plausibly mislabel** (same-family wrong id); re-check via an Identify action on the
  `/inventory` item card. Reveal-on-consumption waits for edibles (cooking, later).
- Flip the `forage` hub action live (riverbank + a woodland location — add it if absent);
  `/inventory` + item card render unidentified/mislabeled names.
**Not in scope**: fishing, cooking, gardening, selling, NPC identify-for-fee (leave a seam).
**Redeploy**: none (hub action + component only).

### S2 — Fishing v1 · [M] · SAFE
**Design**: `Ruleset/professions.md` (R16 fishing — "ported & bounded"); reuses the S1 engine.
**Why**: the old bot's flagship feature and the biggest player-visible win per hour; a second
consumer proves the gather engine is genuinely generic.
**Build**: per-water fish tables via `resourceNodes`; weather/time bias through the D31
condition language; rod/lure as items (a new `tool` item kind + bait — one union member + one
`ITEM_KINDS` meta entry per D28) modifying the check and/or table; fish = item instances with
a per-instance `weightKg` (the bragging stat — bounded per D32: the catch lands in pack/stash,
NEVER an unbounded catch log like OldBot's `gFishing.fish[]`); fishing skill tree (root +
Angling leaf; Netting/Deep-water = later content); flip the `fish` hub action; chronicle rare
catches. **Stretch** (only if trivially cheap): a per-character `heaviestCatch` snapshot for a
future leaderboard category.
**Not in scope**: selling, cooking, a tackle shop, netting/deep-water content.
**Redeploy**: none.

### S3 — NPC roster v1 (static half of 6C) · [S–M] · SAFE
**Design**: `Ruleset/npcs.md` (R18 build order), AUDIT §3.3.
**Why**: presence rendering already shows NPCs — the world just has none; prerequisite for
the shop (S4) and dialogue (S5); zero new runtime engine.
**Build**: `game/data/npcs.ts` (stable `npcId`, name/race/epithet, home location, archetype,
optional starting inventory); a dedicated `characterService.createNpc`-style path minting an
approved `Character` with `ownerId: null` (never through the wizard/approval flow); an
idempotent `scripts/seed-npcs.ts` reusing `confirmDb` — **update-by-npcId, never reset**
(the idempotency key becomes load-bearing the moment ticks mutate NPC state — AUDIT §3.3).
Content: ~5–8 named NPCs across locations (tavernkeeper, plaza merchant, guard, ferryman…).
**Not in scope**: the movement/behavior cron (blocked on Decision queue #7), disposition,
dialogue, dueling NPCs (owner ruled it out — D37).
**Redeploy**: none.

### S4 — Merchant shop / economy v1 · [M] · SAFE
**Design**: `Ruleset/economy.md` + `npcs.md` (merchant stock = NPC inventory), AUDIT §3.6.
**Why**: closes the loop S1/S2 open (goods → coins → gear). Economy.md's own risk note: every
later system must assume THIS flat-price shop exists instead of improvising a stand-in.
**Build**: the plaza merchant NPC's embedded inventory = the stock (v1 restock: static top-up
on read or a simple daily cron — no supply chain); a `shop` component panel reusing the
`/inventory` renderers (as `/stash` did); **buy** = coins out via `applyCurrencyDeltas` + item
transfer NPC→player pack under both characters' locks (insert-before-remove, D33 pattern);
**sell** = reverse at `value × sellRate` (🟡 ~50%) × quality multiplier; prices flat from the
catalog `value` — **no haggle, no reputation modifiers** (both are read-time multipliers
added later without touching stored data); flip the `market` hub action (plaza, daylight
hours already in the catalog). Merchant coins are infinite in v1 (not tracked).
**Not in scope**: haggle checks, reputation pricing, regional currencies (D19), player↔player
trade, buyback.
**Redeploy**: none.

### S5 — Dialogue v1 — talk to an NPC · [M–L] · MOSTLY SAFE
**Design**: `Ruleset/conversations.md` (R14), AUDIT §3.4 ("it's an ActivitySession — resist a
new engine").
**Why**: `talk` is the most-tempting dead button and NPCs exist after S3. Author cost is the
real risk, so: **template-first** — one reusable merchant/guard small-talk archetype (rumors,
greetings, a pointer to their function) + exactly ONE authored named-NPC tree as proof.
**Build**: `dialogue` ActivitySession type + `_activities/` handler; node catalog in code;
options gated/rolled through the existing condition + check language; rolled options credit
speechcraft (D40); session-scoped flags only.
**Not in scope**: persistent quest flags (Decision queue), group dialogue, AI-generated small
talk, quests/rewards.
**Redeploy**: none.

### S6 — Faction reputation v1 · [S] · SAFE (build only after S4/S5 give it consumers)
**Design**: `Ruleset/factions.md`, AUDIT §3.5.
**Build**: faction catalog + sparse per-character `reputation` map (racial baselines applied
at read time — never stored, or a retune becomes a migration); a `minReputation` condition
field (every gate surface inherits it for free); a price-modifier seam in the shop; small ±
rep deltas from dialogue/challenge outcomes.

### Fillers (safe leftovers for a session that runs short)
- `locationStateService.discoverFeature`: convert the `modifiedCount` check to a filter guard
  (known double-fire risk — CLAUDE.md testing caveat).
- Pure content: more encounters/foragables/fish/locations/hub flavor (catalog entries only).
- More flow tests around whichever panel the session touched.
- AUDIT §2.6 index/eviction chores ONLY if actually measured as a problem (audit says don't
  preempt).
- (S1 follow-ups) An Examine action on `/stash` item cards (today: withdraw first); foraging's
  per-family leaves (Mushrooms/Herbs/Fruit & Forage) once per-family gathering matters;
  seasonal/weather-gated table entries via the D31 condition language (one field, no engine).

---

## Decision queue — do przemyślenia przez właściciela (offline, bez sesji)

Brainstorm topics. None of these blocks S1–S6; each blocks the thing named in **Blocks**.
When one is decided: write the outcome into the named `Ruleset/` file (Reference/Ruleset
section), then it can become a session brief.

1. **Skill scale & caps** *(the owner's own top question — `Ruleset/TODO.md`)*: path sums
   reach ~300 (root+branch+leaf) vs the d100 roll; cap at 100? per-tree sum caps? Today
   `checkTarget` clamps [5,95] so nothing breaks, but decide before mass content tuning.
   → `skills.md`. **Blocks**: long-term balance tuning, Mastery >100 design.
2. **Encounter stakes & AP prices**: real damage/loot on travel-challenge outcomes; AP cost
   of travel (placeholder 0) and of gather actions (S1 sets 🟡 values). → `world-travel.md`.
   **Blocks**: travel mattering; a loot-table pass over encounters.
3. **Tavern package**: what a drink does (coins → small heal? Stress relief once Stress
   exists?), Mearog dice rules (the canon gambling game — old backlog), rest/recovery
   specifics (`combat.md` P-recovery). **Blocks**: a tavern session (drink/gamble actions).
4. **XP / points economy + talents** (R13): XP sources, attribute-raise gating/cost curve,
   the launch talent list + requirement modeling. → `skills.md`. **Blocks**: talents UI,
   attribute raises, `progression.points` consumers.
5. **Stress / Sanity numbers & ship timing** (design says: a headline pillar, ships with
   combat depth, not bolted on later). → `flavor-progression.md`. **Blocks**: the Stress bar.
6. **Combat depth order** (Phase 7): hit locations + trauma tally, crit/fumble tables, fate
   points, armour × weapon-type table. Manual turn-by-turn combat only AFTER auto-resolve has
   actually been played (AUDIT §5). → `combat.md`. **Blocks**: all combat layering.
7. **NPC lifecycle**: mortality/reseed-vs-persist policy + hourly tick budget/behavior depth —
   must land BEFORE the NPC movement cron (NOT needed for S3's static roster). → `npcs.md`.
   **Blocks**: the second half of 6C.
8. **Hunger/thirst** *(owner's `Ruleset/TODO.md`)*: rising meters with inverted tick
   semantics — design the model (and whether it's fun at all on a casual server) before any
   build. → `character.md`.
9. **Sparring Elo removal + leaderboard rework** to W/L + streaks + funny stats (the D16
   leftover). Small; anytime.
10. **Old idea backlog** (archived in `DECISIONS.md`; each needs an explicit yes): ambient
    events in normal chat (the highest-retention idea), weekly co-op "Defense of Deltrada"
    (also the AP sink), titles/achievements, seasons/campaigns, Tosch-as-game-actor (AI
    flavor-only per README R6), the images pipeline (`images.md` — needs art + a hosting
    decision first).

## Parking lot (explicitly NOT now)

- Manual turn-by-turn combat — play auto-resolve first (AUDIT §5).
- Cooking & gardening — after foraging/fishing prove the loop; gardening needs property +
  growth-cron infra (professions.md's own order).
- Mongo transactions / service split / ORM / DI — never at this scale (AUDIT §5).
- Regional currencies & exchange (D19), haggle/reputation pricing (until S4+S6 exist).
- Per-location armour coverage & the armour × weapon-type table (needs Decision #6).

## Log

- **2026-07-10 — S1 (Gathering engine + Foraging v1)** ✅ → **D43**: everything in the brief
  shipped (gather resolver + `qualityFromCheck`, resourceNodes + the new `tanglewood`
  woodland, foraging tree, 8 foragables + descriptor pools, identification veil + Examine,
  live `forage` hub action, sim-tuned 🟡 numbers — distributions in DECISIONS.md D43).
  Divergences: quality bands retuned after the first sim (masterwork was becoming the mode at
  high skill); Examine charges a **uniform** 1 AP even on known items (anti-leak — accepted
  trade-off logged in professions.md); no redeploy needed (component-only), but the owner's
  live smoke should include one forage + one Examine.
- **2026-07-10 — S0 (docs)** ✅: CLAUDE.md slimmed (~50% shorter; full D1–D42 texts + old
  backlog archived verbatim in `DECISIONS.md`), PLAN.md created with the S1–S6 queue and the
  owner Decision queue. No code changes.
