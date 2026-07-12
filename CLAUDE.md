# CLAUDE.md — ToscheBot

Handoff doc for humans and AI assistants continuing this work in a fresh session.
**Keep it updated but keep it SLIM**: when a decision lands, add a 1–3-line row to the
decision-log index below; put the game-design detail + why in the matching `Ruleset/` topic
file, and infra/architecture rationale in `DECISIONS.md` (which also archives the full
pre-2026-07-10 texts of D1–D42). The build queue lives in **`PLAN.md`**; the 2026-07-06
code audit in **`AUDIT.md`**.

## What this project is

A Discord bot named **Tosche**, roleplaying **Tosch** (a general) from the webcomic *Beyond
the Western Deep* (BtWD). It serves exactly **one private guild** (the owner's server,
"Deltrada") — multi-guild support is a non-goal and this assumption may simplify code anywhere.

Three faces:

1. **Fun / utility / troll commands** — random flavored responses, generators, converters.
2. **Admin commands** — owner-only server management.
3. **The server RPG** — the server itself is a persistent RPG run by the bot: players have
   characters (resources, attributes, skills, currencies) in MongoDB, with interactive
   activities (combat, travel, professions…), styled after the BtWD universe.

Planned future module (design for it, don't build yet): a separate pen-and-paper style RP
campaign — its own `rp/` domain module and models, unrelated to the server RPG (D9).

> **`Ruleset/`** (repo root) is the **single source of truth for the server-RPG** — design AND
> implementation status. One file per topic (`character`, `skills`, `combat`, `world-travel`,
> `items-equipment`, `economy`, `flavor-progression`, `factions`, `conversations`,
> `professions`, `npcs`, `images`), each shaped **Reference → Ruleset → Implementation → Open
> questions**. **Read the relevant topic file before touching anything RPG-mechanical**, and
> keep it in sync with the code in the same change. (The older `RPG_SYSTEM.md` / `RPG/` were
> folded in and deleted — old paths citing them are historical.)

## Working agreement with the owner (Ravandel)

- The owner communicates in **Polish**; reply in Polish. All code, comments, docs, and
  bot-facing text are in **English**.
- Push back on weak designs — **always paired with a concrete alternative**, not just an
  objection. A plain "yes" is right only when the idea genuinely is the best option.
- **Weigh BALANCE before and while building** (interactions, exploits, extremes — not just
  correctness). When balance isn't obvious, **verify empirically** (D42 pattern): throwaway
  simulation over representative scenarios, read the distribution, tune, report the numbers.
  Tuning values stay 🟡 until the owner signs off.
- `OldBot/` is reference-only legacy code. Never import from it; port ideas, not code.

## Tech stack & toolchain

- **TypeScript 6** (strict), Node ≥ 22.14 (host runs 26), **discord.js v14**, **mongoose 9**
  (MongoDB Atlas **free tier M0**: 512 MB, few connections — lean docs, bulk ops), **node-cron 4**,
  **ESLint 10** (flat, type-checked + `@stylistic` + perfectionist import groups), **Vitest**.
- **No dotenv**: `config.ts` uses `process.loadEnvFile()` (try/catch — VPS may inject env) and
  fails fast on missing vars. `ENV_FILE` picks an alternative env file (`.env.production`,
  `.env.test`). No `uuid` — use `crypto.randomUUID()`.
- **ESM**: `"type": "module"` + NodeNext ⇒ relative imports **must** use the `.js` extension.
  Never `require`/`module.exports` in `src/`.
- **tsx runs TS directly in dev AND production** (D11); no build step, never commit `dist/`.
  Hosting (Sparkedhost) has a fixed `node bot.js` startup command — **`bot.js`** is a
  hand-written shim that installs tsx via its own `register()` export and imports
  `src/index.ts` (D29; raw `node:module` `register('tsx/esm')` throws — verified).
- **One always-on process** — load-bearing: in-memory locks/queues/cooldowns are valid only
  because nothing else touches the DB (see AUDIT §2.4 before ever running dev against prod).
- **Deploy gate**: run `npm run build` + `npm run lint` locally before upload; CI
  (`.github/workflows/ci.yml`) enforces build + lint + test on every push.

### Code style & naming

Machine-enforced by `eslint.config.mjs` — match the codebase, don't introduce new patterns:
3-space indent, semicolons, single quotes, member ordering, import groups (node: → packages →
relative with `.js`), inline `import type`, guard-clause `curly: multi`, `no-else-return`,
`no-console` outside `src/scripts/` + `lib/log.ts`, `switch-exhaustiveness-check`,
`prefer-nullish-coalescing` (possibly-empty strings may use `||`), `no-deprecated`
(discord.js modals = `addLabelComponents` + `LabelBuilder`, not action rows).

- **Naming**: `PascalCase` types/classes, `camelCase` functions/variables/files,
  `SCREAMING_SNAKE_CASE` module-level catalogs/tunables. Boolean fns prefixed `is`/`can`/`has`.
  A file's default export name matches its filename.
- **`interface`** for object/entity shapes; **`type`** for unions/mapped/derived.
- **Plain object literals over classes** for stateless modules (services, AI); `class` only
  for real runtime state (`ToscheClient`, `CharacterLockManager`, `CooldownManager`).
- **Guard clauses**: braceless single-line early returns, no `else` after `return`.
- **Doc/inline comments** only for non-obvious constraints/heuristics/invariants.
- When a convention changes, change the ESLint rule and this section together.

### Environment variables (`.env`, never committed)

| Variable | Purpose |
|---|---|
| `BOT_TOKEN` | Discord bot token |
| `CLIENT_ID` | Application id (slash registration) |
| `GUILD_ID` | The single guild id |
| `OWNER_ID` | Owner's Discord user id (`ownerOnly` gate) |
| `MONGODB_URI` | Atlas connection string |
| `OPENAI_API_KEY` | Optional — AI persona; absent ⇒ AI disabled, bot still runs |
| `OPENAI_MODEL` | Optional — overrides default model (`gpt-5-nano`) |

### npm scripts

- `dev` (tsx watch) · `start` (tsx — what the host runs) · `build` (`tsc --noEmit`, gate only)
  · `lint` · `test` (vitest; `test:watch`).
- `deploy` — **guild-scoped** slash registration (never global). Rerun after ANY slash
  definition change.
- `clear-commands` — wipes the guild slash registrations of whatever app the active env
  resolves to (cleans the local test bot off the shared guild).
- `seed` — rebuilds the alpha roster from owner-edited `src/scripts/seed-data.ts` by replaying
  **wizard inputs** through the real services (D38); idempotent. Requires a **typed DB-name
  confirmation** (interactive, or `SEED_CONFIRM_DB=<name>`); guard in `scripts/confirmDb.ts`.
- `seed-npcs` — populates/refreshes the NPC roster from `game/data/npcs.ts` (D44); idempotent
  update-by-npcId, never resets mutated NPC state. Same guard style (`SEED_NPCS_CONFIRM_DB`).
- `restore` — disaster recovery from a `db-backup`/`h!backup` dump: wipes and re-inserts the
  snapshot (collections absent from the dump are dropped). Same confirmation
  (`RESTORE_CONFIRM_DB`). Dumps are relaxed EJSON; legacy plain-JSON dumps revived by shape.

## Decision log (index)

One line per decision — **full original text + rationale in `DECISIONS.md`**; game-design
detail in `Ruleset/`. Numbers are append-only; new entries stay 1–3 lines here.

| # | Decision |
|---|---|
| D1–D3 | Slash commands only for the server RPG; everything else = `h!` prefix commands; admin = a normal prefix command with `ownerOnly: true` (no admin prefix/class). |
| D4 | Commands are plain typed objects (`satisfies PrefixCommand/SlashCommand`), no class hierarchy. |
| D5 | Concurrency = per-character async locks + per-character deferred FIFO queues (no global queue). |
| D6 | DB writes prefer atomic clamped deltas (aggregation-pipeline `$inc` with min/max) over read-modify-write. |
| D7 | Cron jobs are idempotent + bulk-first: one `updateMany` for unlocked characters, deferred ops for locked. |
| D8 | AI persona behind the `ai/` seam, optional via `OPENAI_API_KEY`. |
| D9 | Future pen-and-paper RP = separate `rp/` domain module, own models, not sharing server-RPG profiles. |
| D10 | Static content lives in code as typed catalogs; DB stores only instances/state referencing stable string ids — see "Content vs state". |
| D11 | Production runs TS via tsx; `build` is a type-check-only local gate; no `dist/` in git. |
| D12 | Account (per Discord user: settings, `activeCharacterId`) ↔ Character (uuid-keyed entity; NPC = `ownerId: null`); currencies + ELO live per character. |
| D13 | Approval lifecycle `draft → pending → approved/rejected`; unapproved characters can't take character-actions; petitions go to the owner channel, not DMs. |
| D14 | (historic) "No stat/combat mechanics before the ruleset" — since superseded by D25/D26/D34/D35/D39–D42; balance **numbers** still stay 🟡 until owner sign-off. |
| D15 | Action Points: no cap, hourly `$inc`; spending only via atomic clamped `spendActionPoints`. |
| D16 | Smackdown two tiers: `sparring` = for-fun, any active character, pure random (its Elo to be removed someday); serious = `duel` (D35). |
| D17 | Long interactive activities are durable: `ActivitySession` doc = per-step state AND the cross-restart busy lock; step-guarded atomic advances; TTL reap. AP charged at start; clean cancel refunds; timeout forfeits. |
| D18 | Locks keyed by `Character._id` (not user id); deferred queues drain BEFORE lock release. |
| D19 | One currency (`deltradaCoins`) until the economy exists; regional per-race currencies reserved. |
| D20 | Character creation = step-driven wizard over the draft doc; steps in a typed catalog; no stored cursor — progress derived from filled fields. |
| D21 | World = data-driven location graph; edges undirected + test-validated; each move may roll an encounter (`flavor` line, or `activity` that interrupts the move until resolved). |
| D22 | Durable activities dispatch via a `type → handler` registry; busy = has an active session; gated commands **re-enter** (re-render current step) instead of erroring. |
| D23 | Regen splits on busyness: vitals pause while busy (skipped, not deferred), AP always accrues. |
| D24 | Gameplay replies are ephemeral; noteworthy outcomes post short in-character lines to the public chronicle channel (fire-and-forget, never failing the action). |
| D25 | 8 attributes; racial base = 25 ± net-zero ±5 modifiers; creation point-buy 50 pts (max +20 on one); allocation stored separately so a race switch rebases, not corrupts. |
| D26 | Travel encounters = multi-approach challenges on the d100 roll-under engine (`game/checks.ts`: Success Levels, difficulty, race affinity); per-option targets precomputed at session start (honest % on repaints); outcomes may grant deed traits. |
| D27 | Account-level settings live on `Account`; `/profile` = account panel, `/character view` = character sheet. |
| D28 | Inventory/equipment: discriminated-union item catalog (WHFRP properties, per-instance craftsmanship quality); embedded pack + `equipment` slot→instance map; equipped gear modifies **effective** attributes; requirements checked vs **base**; 2H occupies both hands; every mutation = lock + fresh re-read + filter-guarded atomic write, refused while busy. |
| D29 | Host startup is fixed `node bot.js` — the shim calls tsx's own `register()` then imports `src/index.ts`. |
| D30 | `/play` = the single game hub (location, vitals, travel select, per-location action buttons from `hubActions.ts`); standalone `/travel` removed. |
| D31 | Living locations: static catalog + lazy per-location `LocationState` doc (weather spells, running events, server-wide discoveries, clamped stats, visits); **presence derived** from indexed `Character.locationId`, never stored; one typed condition language (time/weather/event/discovery/traits) gates hub actions, encounters, event starts; clicks re-validate at click time. |
| D32 | Persistence follows access pattern: bounded + hot-path ⇒ embed on Character (sparse `progression` {skills, talents, points}); unbounded or rarely-read ⇒ own collection. |
| D33 | Stash = per-instance `Item` collection (indexed `{ownerId, container}`, server-side paged); the carried pack stays embedded; **equip only ever from the pack**; transfers insert-before-remove under the character lock (crash ⇒ recoverable duplicate, never a lost item). |
| D34 | Skills are arbitrary-depth **trees in code**; a character stores a **sparse flat node map**. Effective = weighted attribute blend (inherited from nearest ancestor, overridable) + Σ points along root→leaf (+ `extraNodes` cross-paths); uncapped, clamped [5,95] only in check targets; growth via named band profiles (root slowest). Adding a branch/tree = catalog edit, zero migration. |
| D35 | Real duel engine: opposed d100 per exchange; damage = weapon + net SL + StrengthBonus − Soak (min 1 on a connecting hit); Soak = ConstitutionBonus + AV; fights over real persisted `resources.health`; 0 = Downed, no other cost; consent-gated `/smackdown duel`; auto-resolve = short in-memory action (D5 rule 1); styles/hit-locations/crits were marked seams (styles landed in D41). |
| D36 | Bout modes are a catalog (`loadout`: Full Gear / Bare-Knuckle live; arena / weapon-filter / NPC-opponent / stakes = typed seams); leaderboard categories data-driven (`/leaderboard [category]`). |
| D37 | PvE Spire ladder (`/smackdown trial`): champions = hand-authored `CombatProfile` stat blocks (never DB characters, no consent); `trialRung` is `$max`-monotonic; reward only on a climb win; rematches allowed (no reward); roster browser panel, no free-text opponent arg. |
| D38 | `npm run seed` replays hand-recorded creation **inputs** through the real services (guarded approval transitions, never raw writes); idempotent. **MAINTENANCE RULE**: any change to the creation-input shape must extend `SeedCharacter` + the runner in the same commit. |
| D39 | Health/Stamina max derived from attributes (Constitution-led; + minor STR/WP for health, WP for stamina), recomputed on race/allocation change via `applyMaxResources` (full stays full; wounds keep their value under a new cap); constants tuned so a blank draft = the old flat 20/10. |
| D40 | Learn-by-doing is LIVE: `creditUse` takes fractional uses; combat weight = foePower/yourPower (cap 2.0; 0 at ≤ 0.5 — anti-farm), non-combat = 2·(1 − target/100); sparring credits nothing; only rolled-and-could-fail uses count (locked in `Ruleset/skills.md`); rank-ups narrated. |
| D41 | Fighting styles are family-specific catalog entries (modifiers + typed effects: hamper, riposte), each drawing attack AND defence from a skill node (self-gating, trainable via `trainingNodes`); the combat plan (`/character combat`) = per-family default style + ≤3 conditional switch rules (own/foe HP %, round ≥ N), first-match-wins, re-evaluated every exchange and narrated. |
| D42 | Style family = weapon GRIP (`unarmed \| one_handed \| two_handed \| ranged` seam), style branches under their grip branch; initiative FLOWS: a landed blow may press a follow-up (`followUpChance`: net-SL-dominant + style tempo − per-press decay, sim-verified ~67/25/6% streaks for even fights, rare 10+ flurries only across big gaps). |
| D43 | Gathering engine LIVE (R16, foraging first): a gather = SHORT action under the lock (AP → d100 vs a location `resourceNode` → SL-scaled yield + shared `qualityFromCheck` → one-roll identify sweep). Identification veil = optional instance fields (`identified/apparentItemId/descriptorId`, zero migration); failed IDs can plausibly mislabel (same family/shared look); Examine = uniform 1 AP, every outcome equally confident (no roll shown, truth sticky) so nothing leaks which labels are wrong. |
| D44 | NPC roster v1 (static 6C half, PLAN S2): `game/data/npcs.ts` = 7 named NPCs; an NPC's `Character._id` = `npc-<npcId>` (customId-safe) and its static half (archetype, home) resolves from the catalog, never stored (D10); `characterService.createNpc` mints approved ownerless docs outside the wizard/approval flow; `npm run seed-npcs` = confirmDb-guarded idempotent update-by-npcId refreshing ONLY the static half — mutable NPC state (pack, coins 🟡, progression) is never reset. |
| D45 | Dialogue v1 (PLAN S4): a conversation = a `dialogue` ActivitySession walking a code node/option graph (`game/data/dialogues.ts`, graph-test-validated); template-first — ONE `small_talk` archetype dialogue serves every NPC, authored trees per NPC via `NpcDefinition.dialogueId` (`marrek_tales` is the proof). Options gate on session flags + `minTraits`, may roll d100 checks (precomputed honest %, `DIALOGUE_CHECK_AP_COST = 1` 🟡, train speechcraft per D40) and award traits/SESSION-scoped flags (durable flags = Decision queue); start = the live `talk` hub action's NPC picker; the NPC is never a session participant (a chat can't lock the merchant busy); no chronicle. |
| D46 | Image compositing seam LIVE (`game/images/composite.ts`, `@napi-rs/canvas`, images.md §Compositing): pure `composite(spec) → Buffer` (base + `image`/`marker` layers at (x,y)); verified working on Sparkedhost via owner-only `h!imagetest` (renders synthetic in-memory fixtures, needs no art). Asset-hosting split: anything the bot's OWN renderer draws ON (map bases, avatar-frame overlays, board/piece art) is **repo-committed** under `assets/images/` and loaded by local path (D10 catalog: id → path) — the render path must not depend on a network fetch succeeding; purely-linked non-composited art may stay external, preferring GitHub raw links over third-party hosts (imgur-style hotlinking rots); a user-supplied `avatarUrl` is the one deliberate remote `ImageSource` inside a composite. No art catalog or DB wiring yet — the seam only. |
| D47 | Rendering toolkit for the future gambling salon (extends D46): `composite()` grew `text`/`rect` layers, rotation + center anchors, and blank-canvas bases (a scene needs zero art); repo bundles DejaVu Sans (`assets/fonts/`, auto-registered by `game/images/fonts.ts` — identical text on every host; a font-less container would render text blank); `cards.ts`/`chips.ts` DRAW playing cards (52 + back, cached) and poker chips programmatically (vector suits + bundled font); `IMAGE_ASSETS` catalog (`assets.ts`: id → `assets/images/` path + named anchor points, file-existence test-validated). Rendering only — deck/shuffle/game rules belong to the salon's own module (PLAN S7). |
| D48 | Animated GIF rendering (`game/images/animate.ts`, extends D46/D47): `renderGif(frames, opts)` encodes a `CompositeSpec[]` into one looping GIF via `@napi-rs/canvas`'s built-in `GifEncoder` (per-frame `getImageData` → `addFrame`) — one encode, one upload, no rerender+`editReply` timer loop (which would fight Discord's edit rate limit and re-upload a full image every tick). `renderCardSpinGif` demos it: a card shrinks to an edge-on sliver and swaps face↔back exactly at the `cos(angle) < 0` crossing (a real card's own geometry, not a canned flip animation) — the salon's reusable "reveal" beat. `h!imagetest gif` renders it live. `composite.ts` internals split into `renderToCanvas` (shared draw pass) + `composite` (PNG on top), so PNG and GIF paths share one layer-drawing implementation. |
| D49 | Shared language engine `src/grammar/` (absorbs `lexicon.ts`, `lib/grammar.ts` and `lib/text.ts` morphology): `vocabulary/` = theme-tagged word-class catalogs (verbs/beings/nouns/adjectives/adverbs; the old lexicon lists live on as themes), `inflect.ts` = English morphology (plural/3rd-person/gerund/past/articles), `compose.ts` = `expand` with chainable modifiers, `sentence.ts` = the situation engine (`themeGrammar` + `randomSentence`; `SituationTheme` = themes covered by EVERY class, compile-enforced; live: combat/labor/mystic/tavern/wilds). First consumer `h!rumor`; fun-only pools stay in `fun/`; no generic `common/` dump. |
| D50 | Item catalog split (AUDIT §2.5 executed): `game/data/items/` = `types.ts` (kinds/qualities/materials/properties + the definition union) + one entry file per kind (`weapons`, `shields`, `armor`, `consumables`, `craftingMaterials`, `clutter`); `items.ts` stays the facade (re-exports + assembles `ITEMS`, foragables still spread in per D43) so every import keeps working. Adding an item = one line in its kind's file; same folder pattern for future big catalogs (fish, per-region encounters) when they grow. |

## Target architecture

```
src/
  index.ts              entry: env check → DB connect → client → login
  config.ts             typed env config (fail fast)
  client.ts             ToscheClient: command registries, lock manager, AI seam
  core/                 loader (commands/events/jobs), locks, scheduler, cooldowns
  commands/
    prefix/<category>/*.ts    one file = one command (fun, utility, admin)
    slash/<category>/*.ts     one file = one command (game)
    components/*.ts           one file = one customId namespace ({ namespace, handle });
                              _-prefixed files = colocated builders/views
    components/_activities/   registry.ts (session type → handler) + one file per activity
  events/*.ts           one file = one Discord event (defineEvent)
  jobs/*.ts             one file = one cron job
  db/
    connect.ts, models/*.ts
    services/*.ts       ALL DB access goes through services
  game/                 server-RPG domain logic, Discord-agnostic where possible
    checks.ts           d100 roll-under engine (skill nodes/attributes, SL, difficulty, affinity)
    character/          pure rules: creation steps, attributes, skills engine, inventory,
                        resources (attribute-derived maxes), identity/limits
    combat/             sparring d20 (throwaway) + real duel (duel/profile/styles/plan/
                        training/bouts/spireLadder/leaderboards)
    activity/           durable-activity pure step reducers (challenge, dialogue…)
    professions/        gather engine (short-action resolver, quality-from-check) +
                        identification (D43)
    world/              travel rules, time (game clock), conditions, events
    images/             layered-image rendering (D46/D47/D48): composite (pure seam), animate
                        (GIF encoding), assets (id→path catalog + anchors), fonts, cards/chips
    chronicle.ts        Discord adapter (marked): public game log
    data/               static content catalogs (locations, skills, races, encounters,
                        hubActions, weather, traits, currencies…) — see D10; items/ =
                        per-kind entry files behind the items.ts facade (D50)
  grammar/              shared language engine (D49), consumed by fun AND game: inflect
                        (English morphology), compose (Tracery-style expand + chainable
                        inflection modifiers), sentence (situation-themed one-liners),
                        vocabulary/ (theme-tagged word-class catalogs: verbs, beings,
                        nouns, adjectives, adverbs — absorbed the old lexicon.ts)
  fun/                  fun-command response pools + generators
  ai/                   persona prompt + optional OpenAI service + trigger
  moderation/           banned-word matcher + #espionage reporting
  settings.ts           guild tunables (channel names, banned words, AI triggers)
  lib/                  small typed helpers (log, random, text = markdown/capitalize,
                        number, units, discord, person, async)
  types/*.ts            contracts: BotConfig, PrefixCommand/SlashCommand, ComponentHandler,
                        BotEvent (+ defineEvent), CronJob
  testing/              memoryDb (useTestDb), fakeInteraction harness
  scripts/              deploy-commands, clear-commands, seed(+data), seed-npcs(+npcSeed),
                        restore, confirmDb
assets/images/          repo-committed art the bot's OWN renderer draws ON (map bases, avatar
                        frames, board/piece art — D46); loaded by local path, never by network
assets/fonts/           bundled TTFs (DejaVu Sans + license), auto-registered by
                        game/images/fonts.ts — text renders identically on every host (D47)
```

**Layering rule: commands are thin** — parse/validate, call `game/`/services, format the
reply. Domain logic never imports discord.js except in clearly marked adapters. The exact
command/event/job shapes live in `src/types/` (slash/events/jobs get `ToscheClient` injected;
prefix commands are message-first, `botClient(message)` is the one documented widening cast).

### Core runtime conventions

- Command files: `export default { ... } satisfies PrefixCommand` (or `SlashCommand`).
  Events: `defineEvent({ name, once?, execute(client, ...args) })` — use `clientReady`.
- **Fail fast at startup** (loader throws on missing export, duplicate name/alias/namespace,
  invalid cron); **never crash at runtime** (every dispatch boundary catches, logs, replies
  with a generic in-character error). Loader skips `_`-prefixed and test files.
- **Component handlers**: customIds are `<namespace>:<action>[:...args]` routed by first
  segment. A handler must respond **exactly once** (`reply` / `update` / `showModal`). Fully
  **stateless**: all state rides in customIds + the DB, so panels survive restarts. A modal
  opened from a panel can `interaction.update()` it (`isFromMessage()`).
- **Mutating component clicks** (reference: `inventory`): fast-fail if in-memory locked →
  `deferUpdate()` → `runExclusive` → **re-read doc** → re-check session-busy → validate
  against fresh state → one atomic filter-guarded service write → repaint via `editReply`.
  Read-only navigation skips the lock (views render from the DB, staleness self-heals).
- **Slash commands that may wait on a lock** must `deferReply` BEFORE `runExclusive` (~3 s
  ack window) and `editReply` inside. Autocomplete must be **read-only** (`peekActiveCharacter`).
- The owner bypasses cooldowns/permission checks (not command logic). Jobs are validated in
  `init()` but started by `clientReady`. Ephemeral = `flags: MessageFlags.Ephemeral`.
- **Every command path must do something sensible bare** (no-arg subcommand ⇒ usable
  menu/message, never a crash/silent no-op). Prefer an interface (buttons/selects) over a
  free-text argument when the choice is from a known set.

### Helpers & response composition

Grow small typed `lib/` modules on demand — never port OldBot's `common.js` god-module, its
validator family, array-or-scalar polymorphism, or stringly-typed dispatchers; helpers return
real values and throw on genuine errors.

Flavour composition has three layers (never hardcode flavour in a command): **data**
(`grammar/vocabulary/` theme-tagged word classes + `fun/` per-command pools, `as const`),
**generators** (`fun/generators.ts` fragment builders), **composer** (`grammar/compose.ts`
Tracery-style `expand`; modifiers chain and inflect via `grammar/inflect.ts`:
`.a/.s/.past/.third/.ing/.capitalize`). Pick by shape: fixed line pool →
`defineRandomResponseCommand` (`commands/prefix/_randomResponse.ts`;
`responses`/`extraResponses`/`funny` options); varied assembled sentence → `expand` +
vocabulary (worked example `h!cost`); situation-flavoured one-liner (game encounters, NPC
gossip, troll commands) → `grammar/sentence.ts` `randomSentence(themes)` / `themeGrammar`
(worked example `h!rumor`); fixed lines agreeing with ONE subject → `lib/person.ts`
`personGrammar` (`h!love`). Adding a response/word = one array line; a new situation theme =
one key mirrored across the five vocabulary maps (compile-checked).

### Testing (Vitest)

Three layers by cost (`przewodnik.md` = owner-facing walkthrough); tests colocated, loader-safe:

1. **Pure unit tests** (`*.test.ts`, the majority) — Discord- and DB-free. Mock randomness
   via `vi.spyOn(Math, 'random')`; fake discord.js objects minimally (`as unknown as Message`).
2. **DB tests** (`*.db.test.ts`) against a real in-memory mongod: call `useTestDb()`
   (`src/testing/memoryDb.ts`) once per file — boots a throwaway server, wires the default
   mongoose connection, wipes collections between tests. For what a mock can't prove:
   pipeline clamps, `$max`/status-guarded transitions, cross-collection transfers, the busy
   switch guard. Never point tests at a shared cloud DB.
   **mongod caveat**: in-memory mongod reports `modifiedCount: 1` even for a NO-OP
   `$set`/`$addToSet` — derive "did it change?" from a **filter guard** (`matchedCount`),
   never from `modifiedCount` (`locationStateService.discoverFeature` still does the latter —
   known double-fire risk, fix on touch).
3. **Interaction-flow tests** (`*.flow.test.ts`) — click → handler → service → in-memory DB →
   repaint, via `src/testing/fakeInteraction.ts` (`fakeButton`/`fakeSelect`/`fakeModalSubmit`,
   `fakeClient`, `routeComponent`; `profile.flow.test.ts` is the reference). Real Discord API
   behaviour (ack window, ephemerals, rendering) stays a manual smoke test via `ENV_FILE` +
   the test bot.

The seed's logic (`scripts/seed.ts`) is split from its CLI so `seed.db.test.ts` covers it
end-to-end.

## Concurrency model (the important part)

Long actions must not be corrupted by concurrent writes (cron regen, other commands), and a
player must not run two activities at once.

- **`CharacterLockManager`** (`core/locks.ts`), keyed by **`Character._id`** (D18 — NPCs are
  lockable; sessions store character ids). "One user, one live activity" is enforced
  separately: `setActiveCharacter` refuses while either character is **busy** (in-memory
  locked OR in an active `ActivitySession` — holds across restarts).
- `runExclusive(characterIds, fn)` — acquires all locks **sorted by id** (deadlock-free),
  runs `fn`, **drains each deferred queue BEFORE release** (a deferred op can never
  interleave with the next holder's critical section).
- `deferOrRun(id, op)` — run now, or push to that character's FIFO queue. Deferred ops are
  small self-contained atomic writes; never `runExclusive` inside.
- `isLocked` / `lockedIds` — cron jobs split bulk vs deferred work.

Rules:

1. **Short auto-resolved actions** (sparring, a gather roll, a trade): lock all participants,
   keep transient state in memory, commit once at the end. On crash the action is simply
   lost (accepted — it was sub-second).
2. **Single atomic clamped writes** need no lock (D6). Locks are for read-modify-write or
   "must not interleave with an activity" semantics.
3. **Cron**: bulk `updateMany` excluding `lockedIds()`, then `deferOrRun` per locked
   character (with D23's free / session-busy / locked three-group split for regen).
4. Locks are **in-memory only** — a crash auto-releases them (nobody is stranded "busy
   forever"); the durable `ActivitySession` carries the real cross-restart state.

### Durable long activities (D17/D22)

- `ActivitySession` `{ type, participantIds, step, status, state, expiresAt }` is both the
  saved per-step state and the cross-restart busy lock. `state` is an opaque blob owned by
  the activity's own code.
- **Commit per step**: `activitySessionService.advance(id, expectedStep, newState)` — a
  step-guarded atomic update, idempotent against double-clicks and crash-replay (a stale
  click returns null ⇒ repaint the current step).
- Components carry `sessionId` in customIds; a **TTL index** on `expiresAt` reaps idle
  sessions (timeout = forfeit ⇒ no side effect needed; only a clean cancel refunds first).
- Handlers live in the `_activities/` registry (`type → { render, onAction }`); the generic
  `activity` router checks liveness + that the clicker owns a participant. **Crash-safe
  completion** (see the `challenge` handler): win the final `advance` (step guard = completion
  mutex) → run idempotent side effects → delete session; `render` can derive the terminal
  outcome and offer a finalize re-entry. Step logic stays pure in `game/activity/`.
- Hang guard: cap lock-hold time; time out external calls (Discord/OpenAI).

Core primitive: **`characterService.applyResourceDeltas`** — aggregation-pipeline update
clamped `[0, max]` server-side; siblings `applyCurrencyDeltas` (≥ 0), `spendActionPoints`
(atomic check-and-spend), `regenAll`/`regen`. Pipeline updates compose D6+D7: hourly regen is
ONE bulk write computing per-character clamped results — no read-modify-write, no lost updates.

## MongoDB modeling notes

> The authoritative current model lives in `Ruleset/` (fields/values per topic). This section
> keeps the shape rationale.

- Core pair: **`Account`** (per Discord user) + **`Character`** (uuid-keyed; NPC =
  `ownerId: null`). Other collections: `ActivitySession` (D17), `LocationState` (D31),
  `Item` (D33), `SmackdownRecord`.
- `models/character.ts` is **derived from the content catalogs** (resources, attributes,
  skills, currencies) — adding e.g. a currency happens in exactly one place. Resources are
  `{ current, max }`; **max is stored, not derived on read**, but its value is
  attribute-derived (D39) and recomputed on attribute changes via `applyMaxResources`.
- Only the two regenerating vitals (`health`, `stamina`) exist; rising meters (hunger,
  stress) have inverted tick semantics and get their own job when built.
- **M0 discipline**: avoid per-message writes and unbounded arrays; bulk-first; sparse maps.
- **D32/D33**: embed bounded + hot-path state (progression, carried pack + equipment); split
  unbounded/rarely-read state into its own collection (the stash). The `equipment` map may
  only reference embedded pack instances — equip-from-stash goes through the pack.
- The old schema in `OldBot/Tosche/modules/schematicsGuild.js` is a reference for what the
  old game tracked — a starting point, not a contract.

### Content vs state (D10)

Static content (items, fish, locations, word lists) is **code**, not DB data — typed data
modules under `game/data/` and `fun/` (`as const satisfies Record<string, X>`, exported
`type XId = keyof typeof X`). Rules:

1. Content ids are **stable slugs**, never display names or indices.
2. Ids are **append-only** once referenced by any DB document (rename/delete ⇒ migrate).
3. Resolving a stored id must tolerate "unknown id" (log + fallback, not crash).
4. Instances store only per-instance fields; static fields resolve from code at read time.
   Exception: snapshot a value that must survive content rebalancing (price at sale time).

## Theme / lore quick reference

Races: canid, ermehn, felis, lutren, polcan, tamian, vulpin. The bot is **Tosche**; the
character is **Tosch**, "everyone's favorite BtWD general". Flavor text is in-character where
it fits; sprinkle tics like ", yes-yes" on ~25% of fun responses (the old bot's spirit).

## OldBot reference

`OldBot/Tosche/` = the previous JS bot, **reference-only** (port ideas + word lists, never
code). Useful: `bot.js` (fun commands + curated word lists), `commands/guild/*` (fish,
smackdown, jail, leaderboards — the game features to rebuild), `modules/schematicsGuild.js`,
`modules/chatGPT.js`. **Anti-patterns — never reproduce**: busy-wait transaction polling
(→ `CharacterLockManager`), the global one-fight-at-a-time flag, hardcoded ids/channel names
(→ config), secrets in source (`bot.js:76` has a **burned** MongoDB credential — never commit
secrets), commands doing DB access directly.

## Status & roadmap (2026-07-10)

**Where the build queue lives: `PLAN.md`** (session-sized briefs + the owner decision queue).
Idea backlog and full decision history: `DECISIONS.md`.

**Built and green** (661 tests, build + lint pass): core runtime; the whole fun/utility/admin
prefix layer; AI persona; moderation + espionage logs; character creation wizard + owner
approval; attributes + point-buy (D25); d100 checks + travel challenges (D26); `/play` hub +
living locations (D30/D31); inventory/equipment + stash (D28/D33); skill trees + LIVE
learn-by-doing (D34/D40); real combat — duel, bout modes, Spire ladder, styles + combat
plans, flowing momentum (D35–D37, D41–D42); seed/backup/restore + CI (D38, AUDIT §1/§2.3/§2.9);
gathering engine + Foraging v1 with identification/mislabels (D43, PLAN S1 — the first real
loot source and the first live hub action); NPC roster v1 (D44, PLAN S2 — 7 named NPCs via
`npm run seed-npcs`, presence lists come alive); Dialogue v1 (D45, PLAN S4 — the `talk` hub
action opens durable conversations: an archetype small-talk template + Marrek's authored tree);
image rendering (D46–D48 — `composite()` verified live on Sparkedhost via `h!imagetest`, the
gambling-salon toolkit (text/rect layers, bundled fonts, programmatic cards/chips), and looping
GIF animation (`h!imagetest gif`); no game consumer wired up yet); shared grammar engine
(D49 — themed vocabulary + inflection + situation sentences; `h!rumor` is the first consumer).

**Missing (current focus — the peaceful core loop, see PLAN.md):** economy/shop (S3 —
nothing earns or spends coins yet), fishing (S6), the NPC behavior cron (6C's second half —
Decision queue #7); hub actions besides `forage` and `talk` are still placeholders; stamina
has no consumer.

**Pending ops (owner):** one `npm run deploy` covers the queued slash changes (`/character
combat`, `/smackdown` trial browser, `/stash`, `/leaderboard` categories); one
`npm run seed-npcs` populates the NPC roster on the live DB. A live end-to-end smoke against
Atlas has still not been run.

**Surfaces:**

- **Prefix `h!`** — ~46 fun/utility commands (`h!help` auto-lists) + admin: `clear`,
  `directmessage`/`dm`, `messagechannel`/`mc`, `backup`, `imagetest` (D46 compositing smoke test).
- **Slash** — `/character` (create wizard/view/list/skills/combat/switch), `/profile`,
  `/inventory` (+ Examine on foraged finds), `/stash`, `/item grant` (ownerOnly), `/smackdown`
  (`sparring` | `duel [mode]` | `trial`), `/leaderboard [category]`, `/play` (travel + the
  live `forage` (D43) and `talk` (D45) actions).
- **Events** — `messageCreate` (moderation → `h!` routing → ambient AI), `interactionCreate`,
  `clientReady`, `messageDelete`/`messageUpdate` (espionage edit/delete log),
  `guildMemberAdd`/`guildMemberRemove`.
- **Jobs** — `resource-regen` (hourly, D23-aware), `db-backup` (daily 04:30 → `#espionage`;
  `h!backup` on demand; `npm run restore` re-imports).
- **Component namespaces** — `character`, `comic`, `activity` (+ `_activities`: `challenge`,
  `dialogue`), `profile`, `inventory`, `stash`, `play`, `duel`, `charskills`, `trial`,
  `combatplan`.

**Phases:** 0–5 ✅ (manual turn-by-turn combat deliberately deferred — AUDIT §5). Phase 6 ✅
except **6C's second half** (the static NPC roster shipped in D44; the behavior cron waits on
PLAN Decision queue #7). Phase 7 = the `Ruleset/` design work — all tuning numbers 🟡 until
the owner locks them. Phase 8 (`rp/` module) = future.
