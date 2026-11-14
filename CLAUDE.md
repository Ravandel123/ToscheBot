# CLAUDE.md — ToscheBot

Handoff doc for humans and AI assistants continuing this work in a fresh session.
**Keep it updated but keep it SLIM**: when a decision lands, add a 1–3-line row to the
decision-log index below; put the game-design detail + why in the matching `Ruleset/` topic
file, and infra/architecture rationale in `DECISIONS.md` (which also archives the full
texts of D1–D50). **`PLAN.md`** is the plan agreed with the owner — what is being built now,
what comes next, what waits for a decision. Read it before starting work, and write new
agreements into it. These three (this file, `PLAN.md`, `Ruleset/`) are everything a fresh
session needs; `DECISIONS.md` is an archive to look things up in, not required reading.

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

> **`Ruleset/`** (repo root) is the **single source of truth for the server-RPG**, in two
> layers. **Rules**: one file per topic (`character`, `skills`, `combat`, `world-travel`,
> `items-equipment`, `economy`, `flavor-progression`, `factions`, `conversations`,
> `professions`, `npcs`, `images`), each shaped **Reference → Ruleset → Open questions →
> Expansion ideas** — rules and reasons only, no code. **Implementation**:
> `Ruleset/implementation/<topic>.md` — which files carry each rule and how far the code gets
> it. **Read both files of a topic before touching anything RPG-mechanical**; a code change
> updates the implementation file in the same change, a rule change updates the rule file.
> (The older `RPG_SYSTEM.md` / `RPG/` were folded in — old paths citing them are historical.)

## Working agreement with the owner (Ravandel)

- The owner communicates in **Polish**; reply in Polish. All code, comments, docs, and
  bot-facing text are in **English**.
- Push back on weak designs — **always paired with a concrete alternative**, not just an
  objection. A plain "yes" is right only when the idea genuinely is the best option.
- **Weigh BALANCE before and while building** (interactions, exploits, extremes — not just
  correctness). When balance isn't obvious, **verify empirically** (D42 pattern): throwaway
  simulation over representative scenarios, read the distribution, tune, report the numbers.
  Tuning values stay 🟡 until the owner signs off.
- **Build one system at a time** (owner, 2026-11-10): follow `PLAN.md` top to bottom, finish
  a step so it is playable before starting the next, and **hide anything unfinished from
  players** (no "coming soon" buttons, no untrainable skill trees). The game should be
  complex inside and one button outside; prefer distinctive ideas over generic ones.
- **Git belongs to the owner.** Only the owner commits, pushes, or changes git state in any
  way (staging, branches, stash, reset, rebase, tags, history). Assistants edit files in the
  working tree and may run read-only git commands (`status`, `diff`, `log`, `show`) — nothing
  else, even when a task seems to call for it. Say what is ready to commit; the owner does it.
- **Keep `przewodnik.md` current.** It is the owner's Polish, from-the-basics walkthrough of
  the bot (gitignored, so it never shows up in a diff or in CI — easy to forget; it once
  drifted four months behind). The assistant maintains it: in the **same change** that
  alters anything it describes — folder layout, start-up or request flow, a concurrency or
  persistence pattern, a command or npm script, an owner operation, which game systems
  exist — update the matching section and its "Stan na" date. It explains how the bot is
  built and why; it does not repeat game numbers (those live in `Ruleset/`). `GUIDE.md` is
  the owner's own notes — never edit it.
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
  because nothing else touches the DB (see "Known risks" before running dev against prod).
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
| `OPENAI_MODEL` | Optional — overrides the default model set in `config.ts` |
| `AI_TRIGGER_NAMES` | Optional — comma-separated names the AI persona answers to, replacing `settings.ai.triggerNames` (the local test bot uses `tyril`) |

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
- `migrate` — runs the idempotent data migrations in `scripts/migrations.ts` (D56). Same
  confirmation (`MIGRATE_CONFIRM_DB`). Back up first.
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
| D12 | Account (per Discord user: settings, `activeCharacterId`) ↔ Character (uuid-keyed entity; NPC = `ownerId: null`); currencies + fight records live per character. |
| D13 | Approval lifecycle `draft → pending → approved/rejected`; unapproved characters can't take character-actions; petitions go to the owner channel, not DMs. |
| D14 | (historic) "No stat/combat mechanics before the ruleset" — since superseded by D25/D26/D34/D35/D39–D42; balance **numbers** still stay 🟡 until owner sign-off. |
| D15 | Action Points: no cap, hourly `$inc`; spending only via atomic clamped `spendActionPoints`. |
| D16 | (superseded by D51) Smackdown two tiers: for-fun `sparring` vs the serious `duel` (D35). |
| D17 | Long interactive activities are durable: `ActivitySession` doc = per-step state AND the cross-restart busy lock; step-guarded atomic advances. (Its TTL reap and timeout-forfeit were removed by D58.) |
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
| D43 | Gathering engine (foraging first): a gather = short action under the lock (AP → d100 vs a location `resourceNode` → yield scaled by Success Levels + `qualityFromCheck`). Identification veil = optional instance fields; a failed identify can plausibly mislabel; Examine costs a uniform 1 AP and never reveals which labels are wrong. |
| D44 | NPC roster: `game/data/npcs.ts`; an NPC's `Character._id` = `npc-<npcId>`, its static half resolves from the catalog; `npm run seed-npcs` is an idempotent update-by-npcId that refreshes only the static half and never resets mutable NPC state. |
| D45 | Dialogue: a conversation = a `dialogue` ActivitySession walking a code node/option graph (`game/data/dialogues.ts`); one `small_talk` template serves every NPC, authored trees per NPC via `dialogueId`. Options gate on session flags + traits and may roll checks (1 AP 🟡). The NPC is not a session participant. |
| D46 | Image compositing (`game/images/composite.ts`, `@napi-rs/canvas`): pure `composite(spec) → Buffer`. Anything the bot's own renderer draws ON is repo-committed under `assets/images/` and loaded by local path; purely linked art may be external; a user `avatarUrl` is the one remote source inside a composite. |
| D47 | Rendering toolkit: `text`/`rect` layers, rotation, blank-canvas bases; bundled DejaVu Sans (`assets/fonts/`) so text renders the same on every host; `cards.ts`/`chips.ts` draw cards and chips programmatically; `IMAGE_ASSETS` catalog. Rendering only — game rules live elsewhere. |
| D48 | Animated GIFs (`game/images/animate.ts`): `renderGif(frames)` encodes one looping GIF — one upload, never a rerender-and-edit timer loop. PNG and GIF share `renderToCanvas`. |
| D49 | Shared language engine `src/grammar/`: theme-tagged vocabulary catalogs, `inflect.ts` (English morphology), `compose.ts` (`expand` with chainable modifiers), `sentence.ts` (situation-themed one-liners). Fun-only pools stay in `fun/`. |
| D50 | Item catalog is a folder: `game/data/items/` = `types.ts` + one entry file per kind; `items.ts` stays the facade. Adding an item = one line in its kind's file. |
| D51 | One for-fun brawl: `h!sparring` (random stats, no character). `/smackdown sparring`, its d20 character formula and Elo are removed. `SmackdownRecord` = `duelWins`/`duelLosses`/`trialRung`; `/leaderboard` ranks duels and the ladder. Old `eloRating`/`wins`/`losses` fields may remain on stored docs, unread. |
| D52 | A bout is saved BEFORE it is narrated: `boutService.commitDuel`/`commitTrial` write damage → learning → reward/record, then the 30–45 s narration runs. Reward coins are paid before the rung advances, so an interruption never leaves a cleared rung unpaid. |
| D53 | Unfinished = hidden, not deleted: hub actions with a `comingSoon` line are filtered out of the hub view, skill nodes flagged `unused` out of the skill panel, resources flagged `hidden` off the sheet. Live hub actions run through `HUB_EXECUTORS` in the `play` component (catalog entry + one executor). |
| D54 | Starter kit (`game/data/starterKit.ts`, contents 🟡): issued once on an approved character's first `/play`, under the lock, tracked by the optional `starterKitGranted` flag — so existing and seeded characters receive it too. |
| D55 | Modifier layer (`game/character/modifiers.ts`): every roll builds its subject with `checkSubject(character)`, which applies all modifier sources — gear and timed effects today — as attribute shifts plus a flat `checkBonus`. A new kind of modifier = one more source there, never an edit per call site. Timed effects = catalog `game/data/effects.ts` + a bounded optional `effects[]` on the character (`{effectId, expiresAt}`; expired entries ignored on read, pruned on the next apply). First effect: Honeyed Mead → Dutch Courage 🟡. |
| D56 | Data migrations: `npm run migrate` runs the idempotent, append-only list in `scripts/migrations.ts` against the raw collections (confirmDb-guarded, `MIGRATE_CONFIRM_DB`); no "applied" bookkeeping. Use only when optional fields cannot absorb a change. |
| D57 | Hourly regen keeps a clock (`JobState.lastHour`, `jobStateService.claimHours`) and also runs at startup (`runOnStart`): hours missed while offline are paid in one pass (cap 168 h 🟡); a restart inside an hour or a double-fired cron pays nothing twice. |
| D58 | Solo activity sessions never expire (no TTL, no `expiresAt`): the character stays busy until the player finishes, and waiting gains nothing. Every activity must author an in-character **exit** (`ActivityExit` on each encounter and dialogue — never a generic "Cancel") that is no better than its worst choice; taking it deletes the session first, so its consequences apply once. The owner clears a stuck session with `h!session`. Shared activities will need per-turn timers when the first one exists. |
| D59 | One command to know: the `/play` hub carries shortcuts to the pack, skills and fighting style (`play:open:<panel>` repaints the hub message, same builders as the slash commands; each panel has "Back to /play" = `play:hub`). `/character combat` opens a one-question panel for the weapon in hand; the full editor is behind "Tactics…". The public sheet has a Refresh button (units ride in the customId). Duel challenges: 30 s per challenger 🟡, one unanswered challenge per target (in-memory `pendingChallenges`, 10 min 🟡). |
| D60 | A shop is an NPC: the merchant's own pack is the stall and its own coins the till (`game/data/shops.ts` → NPC id). `tradeService` trades between two character docs under both locks; write order favours the player on a crash. Prices in `game/economy/trade.ts` 🟡: buy = value × quality × wear, sell = half of the value the SELLER believes (a mislabeled find sells by its label and reaches the stall as what it is; an unidentified one does not sell). Each game day the first visitor resets stock and till to the catalog (`jobStateService.claimDay`) — the faucet (till) and the sink (takings). This reset is what NPC behaviour will replace. |

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
                        resources (attribute-derived maxes), identity/limits, modifiers
                        (the one source of attribute/check shifts — D55)
    combat/             real duel (duel/profile/styles/plan/
                        training/bouts/spireLadder/leaderboards)
    activity/           durable-activity pure step reducers (challenge, dialogue…) and
                        the ActivityExit shape (D58)
    professions/        gather engine (short-action resolver, quality-from-check) +
                        identification (D43)
    economy/            merchant pricing rules (D60)
    world/              travel rules, time (game clock), conditions, events
    images/             layered-image rendering (D46/D47/D48): composite (pure seam), animate
                        (GIF encoding), assets (id→path catalog + anchors), fonts, cards/chips
    chronicle.ts        Discord adapter (marked): public game log
    data/               static content catalogs (locations, skills, races, encounters,
                        hubActions, shops, weather, traits, currencies…) — see D10; items/ =
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
                        migrate(+migrations), restore, confirmDb
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
   **`modifiedCount` caveat**: every schema sets `timestamps: true`, so mongoose bumps
   `updatedAt` on each update and `modifiedCount` is 1 even for a NO-OP `$set`/`$addToSet` —
   on Atlas too, not only in tests (verified 2026-11-10; this was first misread as an
   in-memory-mongod quirk). Derive "did it change?" from a **filter guard** (`matchedCount`),
   never from an unguarded `modifiedCount`.
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

1. **Short auto-resolved actions** (a duel, a gather roll, a trade): lock all participants,
   keep transient state in memory, commit once at the end. On crash the action is simply
   lost (accepted — it was sub-second).
2. **Single atomic clamped writes** need no lock (D6). Locks are for read-modify-write or
   "must not interleave with an activity" semantics.
3. **Cron**: bulk `updateMany` excluding `lockedIds()`, then `deferOrRun` per locked
   character (with D23's free / session-busy / locked three-group split for regen).
4. Locks are **in-memory only** — a crash auto-releases them (nobody is stranded "busy
   forever"); the durable `ActivitySession` carries the real cross-restart state.

### Durable long activities (D17/D22)

- `ActivitySession` `{ type, participantIds, step, status, state }` is both the saved
  per-step state and the cross-restart busy lock. `state` is an opaque blob owned by the
  activity's own code. It never expires (D58).
- **Commit per step**: `activitySessionService.advance(id, expectedStep, newState)` — a
  step-guarded atomic update, idempotent against double-clicks and crash-replay (a stale
  click returns null ⇒ repaint the current step).
- Components carry `sessionId` in customIds. A session ends in exactly three ways: the
  player finishes it, the player takes its **exit**, or the owner ends it with `h!session`.
- **Every activity authors its exit** (`game/activity/exit.ts`): an in-character way out
  with its own label, lines and consequences, never better than the activity's worst
  choice. `activitySessionService.abandon` returns true only for the call that removed the
  session — apply the exit's consequences only then. The handler also provides `title()`
  so busy notes can name what the character is in the middle of.
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
  `Item` (D33), `SmackdownRecord`, `JobState` (hour and day clocks, D57/D60).
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

## Known risks and non-goals

Carried over from the July 2026 code audit and the November 2026 review (both retired):

- **One process only.** In-memory locks, queues and cooldowns are correct only while a
  single bot process touches a database. Never run `dev` against the production
  `MONGODB_URI` while the hosted copy runs.
- **Accepted small races:** a submit double-click can post two approval decrees (the guarded
  transition still wins); stash transfers favour a duplicate over a loss; a consumable's
  decrement, cleanup and effect are separate writes under the lock; a trade's goods and
  coins are separate writes under both locks, ordered so a crash favours the player (D60).
- **Fine at this scale, revisit only if measured:** the leaderboard sort is unindexed;
  `atLocation` returns everyone at a place; the cooldown map never evicts.
- **Moderation scans message text only** — not embeds, filenames, stickers or polls.
- **Do not add:** Mongo transactions, a service/queue split, an ORM layer or DI framework.
  The single-process model is what makes the concurrency story provable; the project's
  enemy is scope, not scale.

## Status (2026-11-14)

**What is being built and what comes next: `PLAN.md`.**

Build, lint and 732 tests are green. The bot is deployed; the work of 2026-11-11 to 11-14
has not been tested on the live bot yet.
Built: core runtime, the fun/utility/admin prefix layer, AI persona, moderation, character
creation + approval, attributes and checks, skill trees with learn-by-doing, the `/play` hub
and living locations, inventory/equipment/stash, the duel engine with styles, plans and the
Spire ladder, foraging with identification, the NPC roster, dialogue, the image toolkit and
the grammar engine, fight records, sessions that never expire with in-character exits, the
hub shortcuts and the first shop (the plaza merchant). Not built: a consumer for Stamina
(hidden until it has one), Action Point prices. The starter kit is built but switched off
(`STARTER_KIT_ENABLED`). Unbuilt hub actions and unused skill trees stay in their catalogs
but are hidden from players.

**Pending owner ops:** `npm run deploy` (`/smackdown` lost `sparring`, `/leaderboard` has new
categories, `/character combat` has a new description); `npm run migrate` once on the live DB
(drops the old sparring record fields and the session TTL index); `npm run seed-npcs` if the
live DB has no NPCs yet — the shop needs the merchant character to exist.

**Surfaces:**

- **Prefix `h!`** — ~46 fun/utility commands (`h!help` auto-lists) + admin: `clear`,
  `directmessage`/`dm`, `messagechannel`/`mc`, `backup`, `session` (list / end stuck
  activities), `imagetest` (D46 compositing smoke test).
- **Slash** — `/character` (create wizard/view/list/skills/combat/switch), `/profile`,
  `/inventory` (+ Examine on foraged finds), `/stash`, `/item grant` (ownerOnly), `/smackdown`
  (`duel [mode]` | `trial`), `/leaderboard [category]`, `/play` (travel, shortcuts to the
  pack / skills / fighting style, and the live `forage`, `talk`, `arena` and `market` actions).
- **Events** — `messageCreate` (moderation → `h!` routing → ambient AI), `interactionCreate`,
  `clientReady`, `messageDelete`/`messageUpdate` (espionage edit/delete log),
  `guildMemberAdd`/`guildMemberRemove`.
- **Jobs** — `resource-regen` (hourly, D23-aware), `db-backup` (daily 04:30 → `#espionage`;
  `h!backup` on demand; `npm run restore` re-imports).
- **Component namespaces** — `character`, `comic`, `activity` (+ `_activities`: `challenge`,
  `dialogue`), `profile`, `inventory`, `stash`, `play`, `duel`, `charskills`, `trial`,
  `combatplan`, `market`, `session`.
