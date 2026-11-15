# CLAUDE.md — ToscheBot

How to work in this repository. It is loaded into every session, so **keep it slim**: it
holds rules and orientation, not history. Where everything else lives:

| File | Holds | Read it |
|---|---|---|
| `PLAN.md` | The plan agreed with the owner: now, next, waiting for a decision, done | Before starting work; write new agreements into it |
| `Ruleset/` | The server RPG: rules per topic, and `Ruleset/implementation/<topic>.md` for which files carry each rule | Both files of a topic, before touching anything RPG-mechanical |
| `DECISIONS.md` | The numbered decision log (D1–D60) with reasons | Only when a rule's reason matters |
| `przewodnik.md` | The owner's Polish walkthrough of the bot (gitignored) | When changing anything it describes — see the working agreement |

A new decision gets a row in `DECISIONS.md`; if it changes how code must be written, the
rule also goes here, in the section it belongs to.

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

A separate pen-and-paper RP campaign may come later: its own `rp/` module and models,
sharing nothing with the server RPG. Design for it, don't build it.

`Ruleset/` is the single source of truth for the server RPG, in two layers. A code change
updates the topic's implementation file in the same change; a rule change updates the rule
file. Balance numbers stay 🟡 until the owner signs them off.

## Working agreement with the owner (Ravandel)

- The owner communicates in **Polish**; reply in Polish. All code, comments, docs, and
  bot-facing text are in **English**.
- Push back on weak designs — **always paired with a concrete alternative**, not just an
  objection. A plain "yes" is right only when the idea genuinely is the best option.
- **Weigh BALANCE before and while building** (interactions, exploits, extremes — not just
  correctness). When balance isn't obvious, **verify empirically**: throwaway simulation
  over representative scenarios, read the distribution, tune, report the numbers.
- **Build one system at a time**: follow `PLAN.md` top to bottom, finish a step so it is
  playable before starting the next, and **hide anything unfinished from players** (no
  "coming soon" buttons, no untrainable skill trees — catalog entries stay, flagged). The
  game should be complex inside and one button outside; prefer distinctive ideas over
  generic ones.
- **Git belongs to the owner.** Only the owner commits, pushes, or changes git state in any
  way (staging, branches, stash, reset, rebase, tags, history). Assistants edit files in the
  working tree and may run read-only git commands (`status`, `diff`, `log`, `show`) — nothing
  else, even when a task seems to call for it. Say what is ready to commit; the owner does it.
- **The repo is public.** No real Discord ids or names in git (the real seed roster is the
  gitignored `src/scripts/seed-data.local.ts`), no `.env` files, no secrets.
- **Keep `przewodnik.md` current.** It is gitignored, so it never shows up in a diff or in
  CI — easy to forget; it once drifted four months behind. In the **same change** that
  alters anything it describes — folder layout, start-up or request flow, a concurrency or
  persistence pattern, a command or npm script, an owner operation, which game systems
  exist — update the matching section and its "Stan na" date. It explains how the bot is
  built and why; it does not repeat game numbers. `GUIDE.md` is the owner's own notes —
  never edit it.
- `OldBot/` is the previous JS bot: reference only. Port ideas and word lists, never code;
  never import from it; never commit it (it contains a burned credential).

## Tech stack & toolchain

- **TypeScript 6** (strict), Node ≥ 22.14, **discord.js v14**, **mongoose 9** (MongoDB Atlas
  **free tier M0**: 512 MB, few connections — lean docs, bulk ops), **node-cron 4**,
  **ESLint 10** (flat, type-checked), **Vitest**.
- **No dotenv**: `config.ts` uses `process.loadEnvFile()` and fails fast on missing vars.
  `ENV_FILE` picks another env file (`.env.production`, `.env.test`). No `uuid` — use
  `crypto.randomUUID()`.
- **ESM** + NodeNext ⇒ relative imports **must** use the `.js` extension. Never
  `require`/`module.exports` in `src/`.
- **tsx runs TS directly in dev AND production**; no build step, never commit `dist/`. The
  host's fixed `node bot.js` startup is a hand-written shim that registers tsx and imports
  `src/index.ts`.
- **One always-on process** — load-bearing: in-memory locks, queues and cooldowns are valid
  only because nothing else touches the DB (see "Known risks").
- **Deploy gate**: `npm run build` + `npm run lint` locally before upload; CI enforces
  build + lint + test on every push.

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
| `AI_TRIGGER_NAMES` | Optional — comma-separated names the AI persona answers to (the local test bot uses `tyril`) |

### npm scripts

- `dev` (tsx watch) · `start` (what the host runs) · `build` (`tsc --noEmit`, gate only) ·
  `lint` · `test` (vitest; `test:watch`).
- `deploy` — **guild-scoped** slash registration (never global). Rerun after ANY slash
  definition change, and note it in `PLAN.md`. `clear-commands` wipes the registrations of
  whatever app the active env resolves to.
- The scripts below touch a database and require a **typed DB-name confirmation**
  (`scripts/confirmDb.ts`). On the live database they are owner operations:
  - `seed` — rebuilds the alpha roster by replaying **creation inputs** through the real
    services; idempotent. **Maintenance rule:** any change to what a player enters at
    creation must extend `SeedCharacter` and the runner in the same change.
  - `seed-npcs` — creates/refreshes NPCs from `game/data/npcs.ts`; updates only the static
    half, never resets an NPC's state.
  - `migrate` — the idempotent, append-only list in `scripts/migrations.ts`; only for
    changes optional fields cannot absorb. Back up first.
  - `restore` — disaster recovery from a `db-backup`/`h!backup` dump.

## Code style

Formatting and most conventions are machine-enforced by `eslint.config.mjs` — match the
codebase, don't introduce new patterns; when a convention changes, change the ESLint rule
and this section together. 3-space indent, semicolons, single quotes, import groups (node: →
packages → relative with `.js`), inline `import type`, braceless single-line guard clauses,
no `else` after `return`, no `console` outside `src/scripts/` and `lib/log.ts`.

- **Naming**: `PascalCase` types/classes, `camelCase` functions/variables/files,
  `SCREAMING_SNAKE_CASE` module-level catalogs/tunables. Boolean functions start with
  `is`/`can`/`has`. A file's default export name matches its filename.
- **`interface`** for object/entity shapes; **`type`** for unions/mapped/derived.
- **Plain object literals over classes** for stateless modules (services, commands);
  `class` only for real runtime state (`ToscheClient`, `CharacterLockManager`).
- discord.js modals use `addLabelComponents` + `LabelBuilder`, not action rows.

### Keeping the code clean

- **Reuse before writing.** A new action, panel or activity starts from the shared pieces
  (listed under "Core runtime conventions"). Lint refuses a hand-built action row or
  ephemeral flag outside `lib/discord.ts`.
- **Extract on the third copy.** Two similar blocks may stay; the third time, move the
  shared part into a helper next to its users. Never abstract ahead of need — no base
  classes or frameworks for views, no options nothing passes.
- **One name per thing**: one type for one shape, one wording for one message, one format
  for one kind of value (quantities read `Name ×3`).
- **Delete instead of keeping**: no unused exports, no commented-out code, no switch or
  flag without a `PLAN.md` entry saying what it waits for.
- **Comments say why, never whence.** Only for non-obvious constraints, heuristics and
  invariants. No decision, rule or step numbers (D28, R16), no plan phases, no history
  ("used to live in…"). Point to a `Ruleset/` file by name when the reader needs the rule.
- **A stale comment is a bug.** A change that makes a comment or a doc untrue fixes it in
  the same change.
- **Small typed helpers** in `lib/`, grown on demand. Helpers return real values and throw
  on genuine errors; no god-modules, no stringly-typed dispatch.
- **Before calling a larger change done**: reread the diff for copy-paste, unused imports
  and exports, and stale comments; run build + lint + test; say what was not verified.

## Architecture

```
src/
  index.ts, config.ts, client.ts   entry, typed env config, ToscheClient (registries, locks, AI)
  core/                 loader (commands/events/jobs), locks, scheduler, cooldowns
  commands/
    prefix/<category>/  one file = one `h!` command (fun, utility, admin)
    slash/<category>/   one file = one slash command (game)
    components/         one file = one customId namespace; `_`-prefixed files are
                        colocated views, actions and helpers (loader skips them)
    components/_activities/   registry (session type → handler), one file per activity,
                        shared.ts
  events/, jobs/        one file = one Discord event / one cron job
  db/models/, db/services/   ALL DB access goes through services
  game/                 server-RPG domain logic, no discord.js (except chronicle.ts)
    checks.ts           d100 roll-under engine
    character/          creation, attributes, skills engine, inventory, resources,
                        modifiers (the one source of attribute and check shifts)
    combat/             duel engine, profiles, styles, plans, bouts, Spire ladder
    activity/           pure step reducers of durable activities; the ActivityExit shape
    professions/        gather engine, identification
    economy/            merchant pricing
    world/              travel, game clock, conditions, events
    images/             layered-image and GIF rendering
    data/               static content catalogs; items/ = one file per kind behind items.ts
  grammar/              shared language engine: inflect, compose, sentence, vocabulary/
  fun/                  fun-command response pools and generators
  ai/, moderation/      persona + optional OpenAI; banned words + #espionage reports
  settings.ts           guild tunables (channel names, banned words, AI triggers)
  lib/                  small typed helpers (log, random, text, number, units, discord…)
  types/                contracts: commands, components, events, jobs, activities
  testing/              memoryDb (useTestDb), fakeInteraction harness
  scripts/              deploy, clear-commands, seed, seed-npcs, migrate, restore
assets/                 images and fonts the bot's own renderer draws with (local paths only)
```

**Layering: commands are thin** — parse and validate, call `game/` and services, format
the reply. Domain logic never imports discord.js. Nothing outside `db/services` touches a
model.

**Surfaces.** Slash commands are only for the server RPG; everything else is an `h!` prefix
command (admin = a prefix command with `ownerOnly: true`). `/play` is the one hub a player
needs: travel, the actions of the current location, and shortcuts to the pack, skills and
fighting style. The current command list is `h!help` and `src/commands/`.

### Core runtime conventions

- Command files: `export default { ... } satisfies PrefixCommand` (or `SlashCommand`).
  Events: `defineEvent({ name, once?, execute(client, ...args) })`.
- **Fail fast at startup** (the loader throws on a missing export, duplicate
  name/alias/namespace, invalid cron); **never crash at runtime** (every dispatch boundary
  catches, logs, and replies with a generic in-character error).
- **Component handlers**: customIds are `<namespace>:<action>[:...args]`, routed by the
  first segment. A handler responds **exactly once**. Fully **stateless**: all state rides
  in customIds and the DB, so panels survive restarts and a stale panel is re-validated at
  click time (location, time of day, item still there).
- **Mutating clicks**: refuse if the character is locked → `deferUpdate()` →
  `runExclusive` → **re-read the doc** → unfinished activity? → validate against fresh
  state → one atomic filter-guarded write → repaint via `editReply`. The shared steps are
  in `components/_characterAction.ts` — use them, don't re-type them: `deferIfFree` (before
  the lock), `readyCharacter` (inside it: re-read, re-entry into an unfinished activity,
  optional may-act gate), `ownedCharacter` (personal panels). Read-only navigation skips
  the lock.
- **Message pieces** are in `lib/discord.ts`: `ephemeral`, `actionRow`, `buttonRows` (rows
  of five), `PanelView` (the one view type). Activity handlers share option rows, exits,
  stale-click repaint and the hub landing through `_activities/shared.ts`; skill-growth
  wording is `_format.ts`, quantity suffix `lib/text.ts`.
- **Slash commands that may wait on a lock** must `deferReply` BEFORE `runExclusive` (~3 s
  ack window). Autocomplete must be read-only.
- **Gameplay replies are ephemeral**; noteworthy outcomes also post a short in-character
  line to the public chronicle channel (fire-and-forget, never failing the action).
- **Save before telling**: an outcome (a fight, a reward) is written before any long
  narration, so a restart cannot undo or half-pay it.
- The owner bypasses cooldowns and permission checks, not command logic.
- **Every command path does something sensible bare** (no argument ⇒ a usable menu or
  message). Prefer buttons and selects over free text when the choice is from a known set.

### Flavour text

Never hardcode flavour in a command. Three layers: **data** (`grammar/vocabulary/`
theme-tagged word classes, `fun/` per-command pools), **generators** (`fun/generators.ts`),
**composer** (`grammar/compose.ts` `expand`, with modifiers that inflect). Pick by shape:
a fixed line pool → `defineRandomResponseCommand`; an assembled sentence → `expand`
(example: `h!cost`); a situation one-liner → `grammar/sentence.ts` (example: `h!rumor`);
fixed lines agreeing with one subject → `lib/person.ts` (example: `h!love`). Adding a
response or a word is one array line. Flavor is in-character where it fits; about a quarter
of fun responses carry a tic like ", yes-yes".

### Testing (Vitest)

Tests are colocated and loader-safe. Three layers by cost:

1. **Pure unit tests** (`*.test.ts`, the majority) — no Discord, no DB. Freeze randomness
   with `vi.spyOn(Math, 'random')`.
2. **DB tests** (`*.db.test.ts`) against an in-memory mongod: `useTestDb()` once per file.
   For what a mock can't prove: pipeline clamps, guarded transitions, cross-collection
   transfers. Never point tests at a shared cloud DB.
3. **Flow tests** (`*.flow.test.ts`) — click → handler → service → DB → repaint, via
   `src/testing/fakeInteraction.ts` (`profile.flow.test.ts` is the reference). Real Discord
   behaviour (ack window, rendering) stays a manual check on the test bot.

**"Did it change?" comes from a filter guard and `matchedCount`**, never from
`modifiedCount`: every schema has `timestamps: true`, so `updatedAt` moves and
`modifiedCount` is 1 even for a no-op update — on Atlas too.

## Concurrency model (the important part)

Long actions must not be corrupted by concurrent writes (cron regen, other commands), and a
player must not run two activities at once.

- **`CharacterLockManager`** (`core/locks.ts`), keyed by **`Character._id`** (NPCs are
  lockable). `runExclusive(characterIds, fn)` takes all locks **sorted by id**
  (deadlock-free), runs `fn`, and **drains each deferred queue BEFORE release**.
- `deferOrRun(id, op)` — run now, or queue behind the lock. Deferred ops are small
  self-contained atomic writes; never `runExclusive` inside one.
- A character is **busy** when it is locked in memory OR has an active `ActivitySession`.
  Switching the active character is refused while either one is busy.

Rules:

1. **Short auto-resolved actions** (a duel, a gather roll, a trade): lock all participants,
   keep transient state in memory, commit at the end. A crash loses the action — accepted.
2. **Single atomic clamped writes** need no lock: prefer aggregation-pipeline deltas with
   min/max over read-modify-write (`applyResourceDeltas`, `applyCurrencyDeltas`,
   `spendActionPoints` — the only way Action Points are spent).
3. **Cron** is idempotent and bulk-first: one `updateMany` excluding `lockedIds()`, then
   `deferOrRun` per locked character. Regen pauses vitals for busy characters; Action
   Points always accrue.
4. Locks are **in-memory only** — a crash releases them; the durable `ActivitySession`
   carries the real cross-restart state.
5. Keep lock-hold time short and time out external calls (Discord, OpenAI) made under a
   lock — a hung call would keep the character busy until restart.

### Durable activities

- `ActivitySession` `{ type, participantIds, step, status, state }` is both the saved
  per-step state and the cross-restart busy lock. `state` is an opaque blob owned by the
  activity's code. It never expires.
- **Commit per step**: `activitySessionService.advance(id, expectedStep, newState)` — a
  step-guarded atomic update, idempotent against double-clicks and crash-replay (a stale
  click returns null ⇒ repaint the current step).
- A session ends in exactly three ways: the player finishes it, the player takes its
  **exit**, or the owner ends it with `h!session`. A command used meanwhile shows the
  unfinished step instead of an error.
- **Every activity authors its exit** (`game/activity/exit.ts`): an in-character way out
  with its own label, lines and consequences, never better than the activity's worst
  choice and never a generic "Cancel". `abandon` returns true only for the call that
  removed the session — apply the exit's consequences only then.
- Handlers live in the `_activities/` registry (`type → { render, title, onAction }`); the
  `activity` router checks liveness and that the clicker owns a participant.
  **Crash-safe completion** (see the `challenge` handler): win the final `advance` → run
  idempotent side effects → delete the session; `render` can derive the terminal outcome
  and offer a finalize re-entry. Step logic stays pure in `game/activity/`.

## Data model

- **`Account`** (per Discord user: settings, `activeCharacterId`) + **`Character`**
  (uuid-keyed; an NPC has `ownerId: null` and the id `npc-<npcId>`). Other collections:
  `ActivitySession`, `LocationState`, `Item` (the stash), `SmackdownRecord`, `JobState`.
- `models/character.ts` is **derived from the content catalogs** — adding a currency or a
  resource happens in one place. Resource max is stored, attribute-derived, and recomputed
  on attribute changes (`applyMaxResources`).
- **Embed bounded, hot-path state** on the character (skills, carried pack, equipment);
  give **unbounded or rarely-read state** its own collection (the stash). Equipment may
  only reference pack instances. Transfers insert before they remove: a crash duplicates,
  never loses.
- **M0 discipline**: no per-message writes, no unbounded arrays; bulk-first; sparse maps.
- Presence at a location is derived from `Character.locationId`, never stored.

### Content vs state

Static content (items, locations, skills, encounters, word lists) is **code** — typed
catalogs under `game/data/` and `fun/` (`as const satisfies Record<string, X>`). The DB
stores only instances and state that reference it:

1. Content ids are **stable slugs**, never display names or indices.
2. Ids are **append-only** once any document references them (rename/delete ⇒ migrate).
3. Resolving a stored id must tolerate "unknown id" (log + fallback, not crash).
4. Instances store only per-instance fields; static fields resolve from code at read time.

Adding content is a catalog edit with no migration: an item is one line in its kind's file,
a skill branch one entry in `skills.ts`, a live hub action one catalog entry plus one
executor in the `play` component.

## Lore quick reference

Races: canid, ermehn, felis, lutren, polcan, tamian, vulpin. The bot is **Tosche**; the
character is **Tosch**, "everyone's favorite BtWD general".

## Known risks and non-goals

- **One process only.** Never run `dev` against the production `MONGODB_URI` while the
  hosted copy runs.
- **Accepted small races:** a submit double-click can post two approval decrees (the
  guarded transition still wins); stash transfers favour a duplicate over a loss; a
  consumable's decrement, cleanup and effect are separate writes under the lock; a trade's
  goods and coins are separate writes under both locks, ordered so a crash favours the
  player.
- **Fine at this scale, revisit only if measured:** the leaderboard sort is unindexed;
  `atLocation` returns everyone at a place; the cooldown map never evicts.
- **Moderation scans message text only** — not embeds, filenames, stickers or polls.
- **Do not add:** Mongo transactions, a service/queue split, an ORM layer or DI framework.
  The single-process model is what makes the concurrency story provable; the project's
  enemy is scope, not scale.
- **OldBot anti-patterns, never reproduce:** busy-wait polling for a lock, a global
  one-fight-at-a-time flag, hardcoded ids and channel names, secrets in source, commands
  doing DB access directly.

## Status (2026-11-14)

Build, lint and 733 tests are green. The bot is deployed; the work of 2026-11-11 to 11-14
has not been tested on the live bot yet. What is being built, what comes next and the
outstanding owner operations are in `PLAN.md`.

Built: core runtime, the fun/utility/admin prefix layer, AI persona, moderation, character
creation and approval, attributes and checks, skill trees with learn-by-doing, the `/play`
hub and living locations, inventory/equipment/stash, the duel engine with styles, plans and
the Spire ladder, foraging with identification, NPCs and dialogue, the first shop, the
image toolkit and the grammar engine. Not built: a consumer for Stamina (hidden until it
has one), Action Point prices. The starter kit is built but switched off.
