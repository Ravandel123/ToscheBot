# Code audit — 2026-07-06

A full read of `src/` (~19.5k lines), the `Ruleset/` design folder, and the toolchain, done
in one pass by an AI assistant at the owner's request. Scope: is the architecture sound, what
will crack under growth, what to patch now vs plan for. Verdict up front:

> **The project is going in the right direction and the architecture is sound.** The load-bearing
> decisions — content-in-code (D10), per-character locks + atomic clamped writes (D5/D6),
> stateless components, durable ActivitySessions (D17), embed-bounded/split-unbounded persistence
> (D32/D33), data-driven catalogs everywhere — are consistently applied across all ~30 systems,
> and each new system (duel, trial, stash, living locations) landed as *content + one thin
> handler* rather than new plumbing. Nothing needs re-architecting at this stage. The risks below
> are wear points and operational gaps, not design flaws.

Verified during the audit: `npm run build` ✅, `npm run lint` ✅, `npm test` ✅ (424 tests before
the audit, **430 after** — six added). `dist/` is not committed; no secrets in `src/`
(OldBot's burned credential stays quarantined by `.gitignore`).

---

## 1. Fixed during the audit (already in the tree)

| # | Change | Why it mattered |
|---|---|---|
| F1 | **Daily DB backup**: `jobs/dbBackup.ts` (04:30, posts a JSON dump of every collection to `#espionage`) + `h!backup` (ownerOnly, on demand) + `db/backup.ts` (pure dump builder, DB-tested). | Atlas **M0 has no backups** — the entire game state was one bad wipe/fat-finger away from unrecoverable. This was the highest-value gap in the whole project (it sat in the idea backlog; now built). Daily, not weekly: the dump is a few KB at this scale and an alpha deserves a short recovery window. Restore is manual for now (see §3.2). |
| F2 | **`itemService.deposit` no longer reads the whole stash** to mint a unique handle. A `{ ownerId, instanceId }` **unique index** on `Item` now enforces uniqueness; deposit mints-and-inserts, retrying the (astronomically rare) collision. | The old code did `Item.find({ ownerId })` on every deposit — O(hoard) per click, directly contradicting D33's "reads never load the whole stash" contract. It would have degraded exactly when the stash feature succeeded (thousands of stored items). |
| F3 | **First-click-wins guard on the duel consent card** (`startingCards` set keyed by message id in `components/duel.ts`; Decline also refuses once a fight is starting). | Two near-simultaneous Accept clicks are two interactions that could BOTH pass the `isLocked` pre-check before either acquired the lock → double fight, double damage. The code comment admitted the race; it's now closed (single-process, so an in-memory set is a real mutex). |
| F4 | **30 s timeout + 1 retry on the OpenAI client** (`ai/aiService.ts`). | The SDK default timeout is 10 minutes — a wedged completion stalled the message handler absurdly long. CLAUDE.md's own hang-guard rule says external calls must be timed out; now they are. |
| F5 | **Discord-UI-limit guards in catalog tests**: ≤20 hub actions per location (5-row cap minus the travel select), ≤24 challenge options (button rows), ≤25 roads per location (select-option cap). | These limits are invisible until a content edit crosses them — then the message API errors at runtime, mid-game. Now a catalog edit that would overflow the UI fails `npm test` instead, matching the existing content-integrity test style. |
| F6 | **CLAUDE.md refreshed**: test count, `charskills` handler, `/character skills` + body-frame step, `clear-commands` + `backup` commands, `db-backup` job; the backup backlog entry moved to "built". | CLAUDE.md is the handoff doc; it had drifted ~2 sessions behind the code. |

---

## 2. Long-term risks & wear points (not fixed — with the intended patch)

Ordered by how much they'll matter as the game grows. None is urgent at ~10 players.

### 2.1 Locks held across narrated fights (30 s+ with external calls inside)
`smackdown sparring`, `duel` and `trial` hold one or both character locks for the whole
narration (`sleep` pacing × up to 24 blows ≈ 30–45 s, with Discord sends inside the critical
section). A Discord hiccup mid-narration wedges the lock for its retry duration; regen defers;
every panel click by the participants fast-fails "busy".

*Why it's currently OK:* it also guarantees at most one fight narrates per character at a time
(no interleaved fight logs), and discord.js has its own request timeouts. At this player count
the blast radius is two people.

*The patch when it matters:* resolve + **persist first** (HP/Elo committed in a short lock),
then release and narrate from the precomputed `blows[]` outside the lock. Costs: two fights
involving the same character could narrate interleaved (cosmetic), and the "fight in progress"
protection would need a lighter in-memory flag (the F3 `startingCards` pattern generalizes).
This also fixes 2.2 for free. Do it when building the **manual turn-by-turn** mode (R24
option 2) — that rework touches the same seam anyway.

### 2.2 Duel damage is persisted *after* the narration
`runDuel` narrates all blows, then writes HP. A crash/restart mid-narration = a fight the
players *watched* that never happened (no HP change, no chronicle). Accepted under D5 rule 1
(short actions may be lost), but unlike sparring the audience *saw* half of it. The 2.1 patch
(persist-then-narrate) removes this window; until then it's a known, low-frequency oddity.

### 2.3 Restore is manual
F1 gives you the dump file; there is no `npm run restore`. For a real disaster you'd
re-import by hand (mongoimport per collection, or a one-off script). Worth ~an hour once:
a `scripts/restore-backup.ts` that takes the JSON file, **requires the same typed DB-name
confirmation as the seed**, wipes, and re-inserts. Dates arrive as ISO strings — the restore
script must revive the known date fields (`createdAt`, `updatedAt`, `acquiredAt`, `expiresAt`,
weather/event dates) or insert via EJSON. Until it exists, treat the dump as "data is safe,
recovery takes an evening".

> **Resolved 2026-07-07:** `npm run restore` (`scripts/restore-backup.ts` → `db/restore.ts`) —
> same typed DB-name confirmation as the seed (own `RESTORE_CONFIRM_DB` for non-interactive
> runs; the guard was extracted to the shared `scripts/confirmDb.ts`), wipes + re-inserts every
> dump collection (`deleteMany`, keeping indexes) and drops collections absent from the dump so
> the result is the snapshot, never a merge. Dumps are now serialized as **relaxed EJSON**
> (dates lossless); a legacy plain-JSON dump is detected and its ISO date strings revived by
> shape (safe — every `_id` in this project is a plain string). Covered by `restore.db.test.ts`
> plus an end-to-end CLI smoke against a throwaway in-memory mongod.

### 2.4 The single-process assumption is load-bearing and silently violable
In-memory locks, deferred queues, cooldowns, and the F3 duel guard are all correct **only**
while exactly one bot process touches the DB. Two ways to violate it by accident: running
`npm run dev` locally against the **production** `MONGODB_URI` while the VPS copy runs
(the `.env`/`.env.production` split protects you only if you keep honoring it), and a host
that overlaps processes during restart. Cheap insurance if it ever worries you: a startup
"lease" doc (one `findOneAndUpdate` heartbeat with a TTL) that makes a second process log
loudly and exit. Not built — noted so the invariant stays conscious.

### 2.5 Content catalogs will outgrow single files, not the design
`items.ts` is 582 lines with ~a dozen items; a real economy will want hundreds. The pattern
scales, the file won't. When a catalog passes ~1k lines, split it into a folder
(`game/data/items/{weapons,armor,consumables,materials}.ts` re-exported from `items.ts` so
every import keeps working). Same future split for `encounters.ts` per region. Zero migration
either way (ids are the contract, not file paths). Don't do it preemptively.

### 2.6 Unbounded-ish reads that are fine now, worth an index/limit later
- `smackdownService.getLeaderboard` sorts the whole collection per call, unindexed — fine
  for ≤ a few hundred records; add indexes on `eloRating`/`wins`/`trialRung` when the
  collection outgrows that (one line each in the model).
- `characterService.atLocation` rides the `locationId` index but returns everyone — fine
  until NPC seeding (6C) puts dozens of NPCs in one place; the hub already caps display at
  10 names, so add a `.limit()` + count query then.
- `CooldownManager` never evicts expired entries — bounded by (commands × users), trivial
  for one guild, but worth remembering it's append-only if commands ever take per-channel keys.

### 2.7 Moderation only scans `message.content`
Banned-word evasion via embeds, attachment filenames, stickers, or polls isn't checked
(and the collapsed-match pass can't see them). Known scope, fine for a friends' server —
listed so it's a decision, not an oversight.

### 2.8 `getFresh` + presence run on every hub open
Each `/play` render = 1 LocationState upsert-read (+ occasional weather/event writes) +
1 presence query + N `characterService.get` in the activity router's participant check.
All indexed, all tiny; on M0 this stays comfortably inside limits at 10× today's traffic.
No action — measured awareness only. If the server ever grows 10×, add a 5–10 s in-memory
memo of `HubContext` per location (single process makes that trivially correct).

### 2.9 Deploy gate is still manual
`build`+`lint`+`test` run on the developer's honor before upload; the repo has a GitHub
remote, so the backlog's **CI (GitHub Actions)** entry is now just a 20-line workflow away
(`on: push` → `npm ci && npm run build && npm run lint && npm test`). The only nuance:
`mongodb-memory-server` downloads a mongod binary in CI (cache `~/.cache/mongodb-binaries`).
Recommended as the next infra chore; it also protects the seed/backup scripts.

> **Resolved 2026-07-07:** `.github/workflows/ci.yml` — `npm ci` → `build` → `lint` → `test`
> on every push (+ manual dispatch), with the mongod binary pinned via `MONGOMS_DOWNLOAD_DIR`
> and cached keyed on `package-lock.json`.

### 2.10 Small documented races that stay accepted (by design)
For the record, these were examined and deliberately left as-is, matching the codebase's
stated policies: the duplicate-decree post on a submit double-click (guarded transition wins,
loser's decree stays visibly stale); trial reward's `advanceTrial` → coins being two writes
(a crash between loses the coins, never double-pays); withdraw/deposit's favor-duplicate-
over-loss; TTL-reaped sessions forfeiting silently (D17's charge-at-start policy);
`consumeItem`'s decrement → cleanup → resource-delta sequence (lock-serialized). All are
consistent with D5/D6 and documented where they live.

---

## 3. Ruleset review — direction & how to build what's designed

The `Ruleset/` folder is in excellent shape: the five-part file shape (Reference → Ruleset →
Implementation → Open questions → Ideas/risks) keeps design and code honest, and the design
itself consistently respects the two-layer pillar (casual default / deep min-max). The
following is the audit's read on **how** to execute the designed-but-unbuilt systems on the
existing architecture — build-order advice, not new design.

### 3.1 The one missing keystone: a `creditUse` consumer
The skill engine (D34) is built, tested and **dead** — no live action credits skill use, so
nothing in the game grows yet. Every profession/combat/crafting plan depends on this loop
feeling good. The cheapest proof: the TODO's own pick, **foraging** —
`hubActions.forage` (riverbank/woodland) → AP spend → `rollCheck(foraging)` →
`grantItems` (herbs already fit the `material` kind) → `creditSkillUse(['foraging'])` →
the "you improved!" line. Every piece exists; it's one handler case + a small catalog.
**Recommendation: build this before any new system** — it converts three built-but-idle
engines (skills, checks, inventory) into a visible game loop and validates the growth
numbers early.

### 3.2 R12 combat (Health pool + hit locations) — layer, don't rewrite
`duel.ts` was explicitly shaped for this: hit-location roll → per-location AV pick →
trauma tally → threshold crit are inserts at the marked `computeDamage`/`exchange` seams;
the R12 Health max (frame + Constitution) lands in the `recalculateMaxResources` seam that
`character.md` already reserves. Two pre-conditions worth doing first: (a) the **pre-fight
stance/style menu** (R24) — a `stance` field already rides `CombatProfile`, so the menu is
a select on the consent card + three numeric modifiers; (b) per-location AV needs armor
items to declare coverage — an additive field on `ArmorDefinition`, no migration. The
per-location **trauma tally** belongs in the fight (in-memory) first; persisting tallies
between fights is a later decision (`combat.md` open question) — don't add a DB field until
that's decided.

### 3.3 NPCs (6C) — static roster first, brain later
`npcs.md`'s build order is right and matches the TODO queue. Concretely: `game/data/npcs.ts`
+ an idempotent `scripts/seed-npcs.ts` (reuse D38's confirmation guard verbatim) gets NPCs
into presence lists with zero new runtime code. The hourly `npc-tick` should copy
`resource-regen`'s exact shape (bulk-first, skip/defer locked ids). One design note **before**
the tick exists: decide NPC removal policy (reseed vs persist), because the seed's idempotency
key (stable NPC id) becomes load-bearing the moment ticks mutate NPC state — a re-run must
*update* rosters without resetting learned state.
`disposition` (per NPC × character) must ship **sparse-only** (store on first interaction),
exactly like skill progression — `npcs.md` already flags the cross-product risk; make the
sparse shape the day-one schema, not an optimization.

### 3.4 Conversations — it's an ActivitySession, resist a new engine
R14's design ("a conversation is a kind of event") maps 1:1 onto the existing durable-activity
stack: `type: 'dialogue'`, nodes in a code catalog, options = the same gate-language
(checks/traits/rep/items), one step-guarded `advance` per choice. The **only** genuinely new
pieces are (a) a per-(character, dialogue) `flags` memory — put it in `progression` (sparse,
bounded by authored content) — and (b) authoring volume. The README's cross-cutting warning
is the real risk: generic reusable dialogue templates for merchant/guard archetypes will beat
bespoke trees per NPC on content-per-authored-hour; build the template path first.

### 3.5 Factions & reputation — a sparse map + a catalog, nothing more
Per-character `reputation: Partial<Record<FactionId, number>>` (sparse, racial baseline
applied at read time from the catalog — **don't** store baselines, or a balance retune
becomes a migration). Spillover (allied/rival factions) is a pure function over the catalog's
relation graph at read time. Gate consumers (prices, dialogue, hub actions) all flow through
the existing condition language — add a `minReputation` field to `LocationCondition` and
every surface gets faction-gating for free. Cheap, high-flavor, but pointless before there
are NPCs/shops to gate — sequence it after 3.3.

### 3.6 Economy — the flat-price shop is the unblocker, haggle is garnish
`economy.md`'s own recommendation stands: one NPC merchant whose `inventory` is the stock,
flat catalog prices, buy/sell only. This closes the loop foraging opens (3.1) and gives coins
meaning. Haggle-as-a-check and reputation multipliers are pure read-time modifiers added
later without touching stored data. The risk note in `economy.md` is correct and worth
repeating as a rule: **every other system should assume the flat-price shop exists, not
invent its own stand-in.**

### 3.7 Stress/insanity, fate points, food likes — wait for their sources
Each of these is a small field + catalog on the existing patterns (a rising meter with
inverted regen semantics; a spend-gated counter; a sparse likes map), but all three are
meaningless without their *feeding* systems (combat fear/darkness events; knockouts;
cooking). Building them early would create dead UI. The design files already say this —
the audit just confirms the dependency order: combat depth → stress; cooking → likes.

### 3.8 Images (R26) — safe any time, keep it a leaf
The text-first/graceful-fallback catalog design has zero coupling; it can land whenever the
owner has art. One implementation note: keep resolution purely in a `game/data/images.ts`
catalog + a tiny resolver consulted by views (hub embed, sheet, encounter cards) — never a
stored URL on documents (D10 discipline; the avatar URL on `identity` is the one deliberate
exception, being user content).

### 3.9 Cross-cutting recommendation — the "content-per-hour" test
The Ruleset's own cross-cutting risk section identifies the true bottleneck: one Imperator
authoring everything. When sequencing R14/R15/R16/R18, prefer the system that produces the
most playable minutes per authored hour: foraging (3.1) and the shop (3.6) are near-zero
authoring; NPCs are cheap per entry; dialogue trees are the most expensive per minute of
play. The architecture makes all of them one-catalog-entry cheap in *code* — the budget to
manage is the owner's writing time, not engineering.

---

## 4. What was checked and found healthy (no action)

- **Concurrency**: lock ordering (sorted ids), drain-before-release, defer-or-run, the
  session-as-durable-lock split, and the switch guard were traced end to end — correct, and
  the DB/flow tests genuinely cover the racy paths (step-guard replays, stale panels,
  busy gates, clamps).
- **Atomicity discipline**: every game mutation goes through filter-guarded single-doc
  updates or clamped pipelines; no read-modify-write escapes the lock contract anywhere
  in `src/`. `regenFields` shares one builder between bulk and single paths as documented.
- **Statelessness**: every component re-resolves from customId + DB; no collector, no
  in-memory view state anywhere. Restart-safety holds across all nine handlers.
- **Fail-fast/never-crash split**: loader/scheduler validation vs dispatch-boundary
  catches — consistent, including the component error fallback and expired-interaction
  tolerance.
- **D10 rule 3 (stale ids degrade gracefully)** is honored *everywhere* a stored id is
  resolved: locations, items, slots, encounters, options, weather, events, bout modes,
  champions, activity types. This is rarer than it should be in hobby codebases and is
  worth protecting in review.
- **Layering**: commands stay thin; `game/` stays Discord-free except the marked adapters
  (`chronicle`, panels/views, activity handlers). The one "widening cast" (`botClient`)
  remains the only one.
- **Security/permissions**: ownerOnly gates on admin surfaces, ownership checks on every
  personal panel, consent on real-stakes PvP, the seed's typed DB confirmation, no secrets
  in the tree, moderation exempting the owner as documented.
- **Free-tier discipline**: bulk-first cron writes, server-side stash paging, sparse maps,
  bounded embedded arrays, lean reads with projections where it matters.

## 5. Explicitly *not* recommended

To pre-empt future second-guessing: **do not** add Mongo transactions (single-doc atomicity +
the lock manager cover every real need and M0 replica-set transactions add latency and
failure modes), **do not** split into services/shards/queues (the single-process model is a
feature — it's what makes the whole concurrency story provable), **do not** introduce an ORM
abstraction over mongoose or a DI framework (the plain-object services are the right size),
and **do not** build the manual combat mode before auto-resolve has been played (R24's
build-order reasoning is correct). The current architecture is the appropriate size for this
project's actual constraints; its main enemy is scope, not scale.
