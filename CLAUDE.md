# CLAUDE.md — ToscheBot

This file is the single source of truth for the project. It is written for both humans
and AI assistants continuing this work in a fresh session. **Keep it updated**: whenever
a design decision is made, a phase is completed, or a convention changes, record it here.

## What this project is

A Discord bot named **Tosche**, roleplaying the character **Tosch** (a general) from the
webcomic *Beyond the Western Deep* (BtWD) by Alex Kain & Rachel Bennett. The bot serves
exactly **one private guild** (the owner's server with friends, called "Deltrada").
Multi-guild support is explicitly a non-goal — this assumption may simplify code anywhere.

The bot has three faces:

1. **Fun / utility / troll commands** — random flavored responses, generators, converters,
   chance rolls, etc. (the bulk of the old bot).
2. **Admin commands** — server management, usable only by the owner.
3. **The server RPG** — the Discord server itself is a persistent RPG game run by the bot.
   Members are players with profiles (resources, attributes, skills, currencies) stored in
   MongoDB. Includes interactive activities: turn-based combat, fishing, economy, etc.
   Styled after the BtWD universe.

Planned future module (design for it, don't build yet): a **separate pen-and-paper style
RPG campaign** run by the bot — *not* tied to the server RPG or its characters. It will be
its own domain module with its own data models.

> **`RPG_SYSTEM.md`** (repo root) is the living spec of the server-RPG model *as
> implemented* — entities, catalogs, concrete values, and which parts are real vs
> placeholder. Keep it in sync with the code whenever the RPG model changes.

> **`RPG/`** (repo root) is the **Phase 7 ruleset design project** — a sibling workspace
> with its own `CLAUDE.md`, `Ruleset.md` and `Propositions.md`, where the real game rules
> (d100 roll-under, roles + learn-by-doing skills, Wounds, Stress→Madness…) are designed
> with the owner *before* any mechanics are coded here (D14). Its decisions (R1+, P-forks)
> govern what will replace this bot's placeholder attributes/skills/combat. Read it before
> touching anything RPG-mechanical; keep ids/conventions aligned both ways.

## Working agreement with the owner (Ravandel)

- The owner communicates in **Polish**; reply in Polish. All code, comments, docs, and
  bot-facing text are in **English**.
- The owner explicitly wants better ideas proposed instead of having their initial
  concepts followed blindly. Push back with rationale when a design is weak.
- The `OldBot/` folder is reference-only legacy code (see "OldBot reference" below).
  Never import from it; port ideas, not code.

## Tech stack & toolchain

- **TypeScript 6** (strict), Node >= 22.14, **discord.js v14**, **mongoose 9** (MongoDB
  Atlas **free tier M0** — 512 MB storage, limited connections; keep documents lean and
  prefer bulk operations), **node-cron 4**, **ESLint 10** (flat config, type-checked
  rules via typescript-eslint).
- **No dotenv**: `config.ts` loads `.env` with Node's native `process.loadEnvFile()`
  (wrapped in try/catch — on the VPS, vars may come from the service environment) and
  fails fast on any missing variable. No `uuid` either — use `crypto.randomUUID()`.
- **Module system: ESM.** `package.json` has `"type": "module"`; `tsconfig.json` must use
  `"module": "NodeNext"` + `"moduleResolution": "NodeNext"`. Consequence: relative imports
  in source must use the `.js` extension (`import { config } from './config.js'`).
  Never use `module.exports` / `require` in `src/`.
- Runner: **tsx** in both dev (`tsx watch`) and production (D11). Do not use ts-node /
  ts-node-dev (poor ESM support). tsx is a regular `dependency`, not a devDependency.
- Hosting: **Sparkedhost** (managed Node bot hosting, panel with a configurable startup
  command — changes may require a support ticket; staff confirmed TS runners are
  allowed). Startup command: `npm install && npm run start`. The panel's Node image must
  be **Node 22+**. One always-on process; the single-process assumption is load-bearing:
  in-memory locks and queues are valid because nothing else touches the DB.
- **Deploy gate**: production runs TS directly, so nothing type-checks at startup. Before
  every upload run `npm run build` + `npm run lint` locally (move to CI eventually).
  Never commit `dist/` to git.
- Code style: **3-space indentation** (existing convention), semicolons, single quotes.
  See "Code style & naming conventions" below for naming, import order, and file layout.

### Code style & naming conventions

Formalizes what the codebase already does consistently — don't introduce new patterns,
match these.

- **Naming**: `PascalCase` for types/interfaces/classes, `camelCase` for functions/
  variables/files, `SCREAMING_SNAKE_CASE` for module-level constants (especially catalog/
  tunable values: `RESOURCES`, `MAX_CHARACTERS_PER_ACCOUNT`, `AP_REGEN_PER_HOUR`).
  Boolean-returning functions are prefixed `is`/`can`/`has` (`canEdit`, `isIdentityComplete`).
  A file's default export name matches its filename (`rate.ts` → command `rate`,
  `characterService.ts` → `characterService`).
- **`interface` vs `type`**: `interface` for object/entity shapes (things with fields,
  possibly methods — `CharacterDoc`, `AiService`); `type` for unions, mapped/derived types,
  and generic aliases (`Partial<Record<...>>`, `Pick<...>`).
- **Imports**, in order, one blank-line-free block: Node builtins (`node:crypto`) → third-
  party packages (`discord.js`, `mongoose`) → local modules (relative, **always with the
  `.js` extension** — D-required by NodeNext). Use `import type` (or an inline `type`
  in a named import) for type-only imports.
- **Class member order** (classes are for genuinely stateful singletons only — see below):
  public `readonly` fields → other private fields → constructor → public methods → private
  methods last. `client.ts` and `core/locks.ts` are the reference examples.
- **Prefer plain object literals over classes** for stateless modules — DB services
  (`export const characterService = { ... }`), the AI service, etc. Reserve `class` for
  things that actually hold runtime state across calls (`ToscheClient`, `CharacterLockManager`,
  `CooldownManager`).
- **Guard clauses**: early-return with a braceless single-line `if` (`if (!ok) return;`),
  one per validation step, no `else` after a `return`. Reserve `{ }` blocks for bodies with
  more than one statement.
- **Doc comments**: a `/**...*/` above an exported function/method only when its behavior
  or *why* isn't obvious from its name and signature (same bar as inline comments per
  "Doing tasks" — non-obvious constraints, heuristics, invariants). Don't add one to every
  export by default.

### Environment variables (`.env`, never committed)

| Variable | Purpose |
|---|---|
| `BOT_TOKEN` | Discord bot token |
| `CLIENT_ID` | Application id (slash command registration) |
| `GUILD_ID` | The single guild id |
| `OWNER_ID` | Owner's Discord user id (gates `ownerOnly` commands) |
| `MONGODB_URI` | Atlas connection string |
| `OPENAI_API_KEY` | **Optional** — enables the AI persona; absent → AI disabled, bot still runs |
| `OPENAI_MODEL` | Optional — overrides the default model (`gpt-5-nano`) |

### npm scripts

- `dev` — `tsx watch src/index.ts`
- `build` — `tsc --noEmit` (type-check gate only; production runs TS via tsx, so no
  emit is needed — D11)
- `start` — `tsx src/index.ts` (what Sparkedhost runs)
- `lint` — `eslint .`
- `test` — `vitest run` (`test:watch` for watch mode)
- `deploy` — `tsx src/scripts/deploy-commands.ts` (registers slash commands,
  **guild-scoped only** — instant propagation, no global commands ever). Rerun after
  adding/changing any slash command's definition.

## Decision log

| # | Decision | Rationale |
|---|---|---|
| D1 | Slash commands are used **only for the server RPG** (profiles, combat, activities). | Discoverable UI, autocomplete, buttons/modals fit game flows; the 100-command limit is irrelevant for a scoped game surface. |
| D2 | All other commands are **text commands with the single prefix `h!`** (fun, utility, admin). | Prefix commands have no registration limits and take freeform args — right for a growing pile of troll commands. |
| D3 | **No separate admin prefix or AdminCommand class.** Admin commands are normal prefix commands carrying `ownerOnly: true`. The old `m!` prefix is retired. | Permission is a property of a command, not a taxonomy. One parser, no name-collision rules, trivial to add `requiredPermissions` later. |
| D4 | **Composition over inheritance** for commands: plain typed objects implementing an interface, loaded from files. The empty `Command`/`SlashCommand`/`PrefixCommand` class hierarchy is deleted. | Class hierarchies added nothing; options like `ownerOnly`, `cooldown`, `category` cover all variation. |
| D5 | Concurrency: **per-character async locks + per-character deferred-operation queues** (see "Concurrency model"). Chosen over a single global action queue. | A global queue serializes the whole server behind one slow fight. Per-character locks confine blocking to participants. |
| D6 | DB writes prefer **atomic clamped deltas** (`$inc` via aggregation-pipeline update with min/max clamping) over read-modify-write. | Removes most conflicts outright; cron regen and combat results compose instead of overwriting each other. |
| D7 | Cron jobs must be **idempotent and bulk-first**: one `updateMany` for unlocked characters, per-character deferred ops for locked ones. | Free-tier friendly (few round trips), safe on restart/replay. |
| D8 | AI persona (OpenAI, Tosch-styled replies) behind an `ai/` seam (interface), optional via `OPENAI_API_KEY`. **Done (Phase 5).** | Core bot and game first; keep the bot runnable with AI absent. |
| D9 | Future pen-and-paper RPG is a **separate domain module** (`rp/`), own models, not sharing server-RPG profiles. No dedicated prefix reserved; it will likely use a `/rp` slash group or session channels. | Owner confirmed it's unrelated to the server game. |
| D10 | **Static game content lives in code** as typed data modules (fish, items, word lists...); the DB stores only **instances/state** referencing content by a **stable string id** (see "Content vs state"). | Content is owner-authored and ships with deploys; code gives type-checked ids, git history, and zero free-tier storage/round-trip cost. |
| D11 | **Production runs TypeScript directly via tsx** (`npm run start`); no build step on the host, no `dist/` in git. Type checking (`npm run build`) and lint are a local pre-deploy gate. | Sparkedhost has no build pipeline (host staff confirmed TS runners are fine); dev/prod use the identical runner, eliminating stale-build bugs. Compiling to `dist/` remains available if hosting ever changes. |
| D12 | **Account ↔ Character split** (built in 6A): `Account` = one Discord user (settings, owns characters, `activeCharacterId`); `Character` = the game entity (identity, resources, action points, location, stats), player-owned or **NPC** (`ownerId: null`). **Currencies and Smackdown ELO live per character**, not per account. | A user controls one character at a time and can switch; NPCs are characters with no owner. Replaced the old single `Profile` (keyed by user id) with `Character` (uuid-keyed) + a thin `Account`. |
| D13 | **Characters have an approval lifecycle**: `draft → pending → approved/rejected`. An unapproved character exists (the account is real) but **cannot take character-actions** (serious combat, travel...). Approval requests go to an **owner-only thematic channel** (`settings.channels.imperialDecrees`), not DMs. | Stops low-effort names ("abc"); the owner vets that each character is a real, fitting persona before it can act/appear on ladders. |
| D14 | **`attributes` and `skills` are placeholders pending a dedicated RPG-system design.** Do NOT build stat/combat *mechanics* (point-buy at creation, max-HP-from-attributes recompute, damage formulas) until the ruleset is designed with the owner. The Account/Character *structure* is fine to build; the *numbers/rules* are not. | Owner's explicit call (2026-06-15): "we can't program the system before the RPG system is ready." Structure ≠ mechanics. |
| D15 | **Action Points: no cap.** They accumulate indefinitely via an hourly `$inc` (a week away → a week's worth to spend in a day; no forced daily login — this is for fun). Serious actions (later) cost AP via a single atomic `spendActionPoints` (clamp `>= 0`). | Owner prefers no cap for now; revisit only if hoarding becomes a balance problem (cap is then a one-line clamp in the regen pipeline). |
| D16 | **Smackdown has two tiers.** `/smackdown sparring` = the existing for-fun brawl: **no approval, any active character, pure-random**. It keeps Elo *for now* but Elo will be **removed from sparring later**. A future serious fight (`/smackdown duel`) requires an **approved** character, uses HP/attributes, and **costs AP**. | Players enjoy the silly sparring; keep it. Real stakes belong to the approval-gated, RPG-driven fight. |
| D17 | **Long, interactive, multi-step activities are durable** (turn-based duel, multi-room exploration…). An `ActivitySession` doc (Mongo) holds the per-step `state` AND is the cross-restart "this character is busy" lock; components are **stateless** (keyed by `sessionId`); each step is an **optimistic, step-guarded** atomic update (`{_id, step:N} → $inc step`), making it idempotent against double-clicks and crash-replay; idle sessions are reaped by a **TTL index** on `expiresAt`. **AP policy (default, tunable):** charged at start; clean cancel refunds; **timeout/abandon forfeits** (so a TTL delete needs no side effect). Short, auto-resolved actions stay atomic-commit (D5 rule 1 unchanged for them). | A restart/crash/abandon mid-activity must not corrupt state or strand a player. Persisting **per step** (not just at the end) makes activities resumable + crash-safe, reusing the stateless-component + DB-state pattern already proven by the character panel / comic browser. Seam built (`game/activity/`, `models/activitySession.ts`, `activitySessionService.ts`); first consumer is the serious duel / 6C travel. |
| D18 | **Locks are keyed per character** (`CharacterLockManager`), not per Discord user, and deferred queues **drain before the lock is released**. | Characters are what the writes target (resources/AP/ELO), and NPCs (`ownerId: null`, 6C) have no user id to lock. "One user, one live activity" is already enforced by the active-character switch guard. Draining before release means a deferred op can never interleave with the next holder's critical section — the invariant Phase 7 activities can rely on. |
| D19 | **One currency (`deltradaCoins`) until the economy layer exists.** The lore's regional per-race currencies (amber drops, pearl flakes, obsidian chips…) are reserved for the exchange/trade system being designed in `RPG/` (its P17) and get appended to the catalog when that ships. | Six parallel wallets with no economy were pure bookkeeping. The D10 asymmetry decides the direction: appending a currency later is one catalog line; removing one after players hold balances is a migration. |
| D20 | **Character creation is a step-driven wizard over the draft doc.** Steps live in a typed catalog (`game/character/creationSteps.ts`: id, kind `modal\|select`, `required`, `isComplete`/`summary`); the panel renders FROM it (checklist + step picker + Continue + Submit gate) and `canSubmit` = all required steps complete. **No stored cursor**: the draft `Character` doc IS the wizard state; progress is derived from filled fields. | Interruptible + resumable-across-restarts falls out of the existing stateless-panel pattern with nothing to desync; adding a creation step (origin, starting kit, Phase 7 attribute allocation…) = one catalog entry + one renderer case, not a new flow. Editable-until-approved was already `canEdit` (D13). |
| D21 | **The world is a data-driven location graph with a travel-encounter seam.** `locations.ts` edges are **undirected and test-validated** (a dangling/one-way edge fails `npm test`); `/travel` is the first `canCharacterAct` + `spendActionPoints` consumer (cost placeholder 0 — D14). Each move may roll an encounter from `game/data/encounters.ts`: kind `flavor` (instant line, move completes) or `activity` (the move is **interrupted** by a durable ActivitySession; arrival only on success — forced-back/timeout leaves the character at the origin). | Travel that is "a button that renames a string" is not worth building (backlog note); the encounter seam is where locations become gameplay. Deferring arrival makes an obstacle *mean something* without any stat mechanics. |
| D22 | **Durable activities dispatch through a handler registry.** `ActivitySession.type → ActivityHandler { render(session), onAction(…) }` (`commands/components/_activities/registry.ts`, fail-fast on duplicates); the generic `activity` component namespace routes `activity:<action>:<sessionId>` — the router checks session liveness (incl. lazy expiry) and that the clicker **owns** a participant character; handlers own the step logic. **Busy = has an active session**: the switch guard treats it like a lock (cross-restart), and a gated command run while busy **re-enters** (re-renders the current step) instead of erroring. Reference consumer: `obstacle` (pure-random placeholder à la sparring, D16). | D17 built the durability layer but nothing consumed it; the registry + router make "add an interactive activity" = one handler file + one registry line, with double-click idempotency, crash recovery (terminal outcome derived from state + a finalize re-entry) and restart-surviving buttons solved once, here. |
| D23 | **Regen splits on busyness: vitals pause, AP always accrues.** Resources carry `regenWhileBusy` (health/stamina: `false`); the hourly job writes three bulk-first groups — free characters (full tick), session-busy (AP-only tick; paused vitals are **skipped, not deferred**), in-memory-locked (deferred single tick that decides full-vs-busy when it lands). The lock-free AP `$inc` on busy characters is safe because AP is only ever written via atomic deltas. | You don't heal mid-climb (and pausing regen keeps future in-activity damage meaningful), but AP is "time owned" (D15) and must not punish being mid-adventure. Skipping (not deferring) vitals keeps TTL-reaped sessions side-effect-free (D17). |
| D24 | **Gameplay is ephemeral; noteworthy outcomes go to the public chronicle.** Activity steps and travel replies are ephemeral (only the actor sees their journey); results worth an audience (arrivals, cleared/failed obstacles, future duels) are posted as short in-character lines to `settings.channels.chronicle` via `game/chronicle.ts` — fire-and-forget, never failing the action, never pinging. | Keeps game channels unspammed while giving the server a shared "what's happening in the game" feed (the owner's requested server log); ephemeral play still survives restarts because components re-resolve all state from the DB, never from the message. |

## Target architecture

```
src/
  index.ts              entry: env check → DB connect → client → login
  config.ts             typed env config (fail fast on missing vars)
  client.ts             ToscheClient extends Client: command registries, lock manager
  core/
    loader.ts           discovers & loads commands/events/jobs from folders
    locks.ts            CharacterLockManager (locks + deferred queues)
    scheduler.ts        registers cron jobs from jobs/
    cooldowns.ts        per-command per-user cooldowns
  commands/
    prefix/<category>/*.ts    one file = one command (categories: fun, utility, admin)
    slash/<category>/*.ts     one file = one command (categories: game, ...)
    components/*.ts           one file = one button/select/modal handler ({ namespace, handle }),
                              routed by customId namespace (_-prefixed files = colocated builders)
    components/_activities/   activity handlers (D22): registry.ts (type → handler) + one file
                              per ActivitySession type (obstacle…); dispatched by components/activity.ts
  events/*.ts           one file = one Discord event: { name, once?, execute }
  jobs/*.ts             one file = one cron job: { name, schedule, run }
  db/
    connect.ts
    models/*.ts         mongoose schemas + exported TS types
    services/*.ts       all DB access goes through services (accountService, characterService,
                        smackdownService, activitySessionService)
  game/                 server-RPG domain logic, Discord-agnostic where possible
    character/          pure rules + identity helpers (canCharacterAct/canEdit/canSubmit, limits)
                        + creationSteps.ts (the wizard step catalog — D20)
    combat/             combat engine (engine/stats/elo pure + testable, flavor data)
    activity/           durable-activity pure logic: session timing helpers (D17 seam) +
                        per-activity step reducers (obstacle.ts — D22)
    world/              travel rules over the location graph + encounter rolling (D21)
    chronicle.ts        Discord adapter (marked): posts noteworthy actions to the public log (D24)
    data/               static content catalogs (locations, encounters, fish, items...) — see D10
    ...
  lexicon.ts            GENERAL flavour vocabulary (adjectives, adverbs, nouns, terms…) — reused
                        by fun, the RPG and real commands; NOT fun-only (ported from dataSpeech.js).
                        A single file for now; promote to a lexicon/ folder when it splits.
  fun/                  fun-command response pools + generators (oracle, insults, cost, names, …)
  ai/                   persona prompt + optional OpenAI service (behind AiService) + trigger
  moderation/           banned-word matcher + #espionage reporting
  settings.ts           guild-specific tunables (channel names, banned words, AI triggers)
  lib/                  generic helpers + English mechanics (log, random, text [a/an, syllables,
                        past tense], number, units, discord, grammar, person, async)
  types/*.ts            contracts: BotConfig, PrefixCommand/SlashCommand, ComponentHandler, BotEvent (+ defineEvent), CronJob
  scripts/
    deploy-commands.ts  guild-scoped slash registration (inside src/ so the build gate type-checks it)
```

Layering rule: **commands are thin**. They parse/validate input, call `game/` or
`db/services/`, and format the reply. Domain logic never imports discord.js types
except in clearly marked adapter spots.

### Command shapes (sketch)

```ts
interface PrefixCommand {
   name: string;
   aliases?: string[];
   description: string;
   usage?: string;
   category: 'fun' | 'utility' | 'admin';
   ownerOnly?: boolean;
   requiredPermissions?: PermissionResolvable[];
   cooldownSeconds?: number;
   execute(message: Message, args: string[]): Promise<void>;
}

interface SlashCommand {
   data: AnySlashCommandBuilder;     // name/options/permissions live here (builder union)
   category: 'game';
   ownerOnly?: boolean;
   cooldownSeconds?: number;         // default: none (slash); prefix commands default to 1 s
   execute(client: ToscheClient, interaction: ChatInputCommandInteraction): Promise<void>;
   autocomplete?(client: ToscheClient, interaction: AutocompleteInteraction): Promise<void>;
}
```

Slash commands (like events and jobs) get the `ToscheClient` injected as the first
argument. Prefix commands stay **message-first** on purpose — almost none need the client,
so the rare one that does (`h!help`) uses `botClient(message)` from `lib/discord.ts` (the
single documented widening cast) instead of every command carrying a dead parameter.

`messageCreate` routing: ignore bots → guild check (single guild only) → if content
starts with `h!` resolve & run prefix command (ownerOnly → permissions → cooldown) →
otherwise optional ambient behaviors later (random reactions/replies, throttled).

### Core runtime conventions (Phase 1)

- Command files: `export default { ... } satisfies PrefixCommand` (or `SlashCommand`).
- Event files: `export default defineEvent({ name, once?, execute(client, ...args) })` —
  every event receives the `ToscheClient` as its first argument (no `message.client`
  casting). Use `clientReady`, not the deprecated `ready`.
- **Fail fast at startup**: the loader throws on a missing default export, duplicate
  command name/alias, or invalid cron expression. **Never crash at runtime**: every
  dispatch boundary (event listener, command execute, job run) catches, logs, and
  replies with a generic in-character error.
- Loader skips `_`-prefixed files — use them for helpers/data colocated with commands.
- **Component handlers** (buttons/selects/modals, Phase 6B): one file per `commands/
  components/` exporting `{ namespace, handle } satisfies ComponentHandler`. CustomIds are
  `<namespace>:<action>[:...args]`; `interactionCreate` routes by the first segment to the
  owning handler (parallel to slash-command-by-name). Same fail-fast (duplicate namespace
  throws at load) + never-crash (handler errors caught, generic ephemeral reply). A handler
  must respond exactly once — `reply`, `update`, or `showModal` (the last acknowledges, so
  no follow-up after it). Colocate Discord builders as `_`-prefixed siblings. Three consumers
  so far: `character` (the creation **wizard panel** — step picker/Continue driven by the
  D20 step catalog, race/gender selects, Edit-details modal, Submit — plus the owner's
  approval buttons/modal), `comic` (the `h!comic` browser), and `activity` (the generic
  durable-activity router — D22: resolves the session by id, verifies the clicker owns a
  participant, dispatches to the `_activities/` registry by session type). All are fully
  **stateless** — all state rides in the customIds (+ the DB), so they survive restarts
  and never expire, unlike a per-message collector. A modal opened from a panel button can
  `interaction.update()` that panel (`ModalSubmitInteraction.isFromMessage()`).
- **Slash commands that may wait on a lock** (e.g. `/travel` queued behind a fight) must
  `deferReply` *before* `runExclusive` — an interaction only waits ~3 s for its first ack —
  and use `editReply` inside. Autocomplete handlers must be **read-only**
  (`peekActiveCharacter`, not `getOrCreate`): they fire per keystroke.
- The owner bypasses cooldowns and permission checks (but not command logic).
- Jobs are loaded and validated in `init()`, but started by `clientReady` so they never
  run against a half-ready client.
- Ephemeral replies use `flags: MessageFlags.Ephemeral` (the `ephemeral` option is
  deprecated).

### Helpers — do NOT port OldBot's `common.js`

OldBot's `modules/common.js` is an 1820-line god-module. **Do not port it wholesale.**
Grow small, cohesive, typed `lib/` modules on demand instead:

- `lib/random.ts` — `randomInt`, `randomItem`, `chance`, `weightedItem` (the typed
  replacement for the old 2D-array frequency lists).
- `lib/text.ts` — pure `string → string` flavor helpers (`bold`, `capitalize`, ...).
- `lib/discord.ts` — `chunkMessage` / `replyChunked` (the > 2000-char splitter that
  OldBot's naive `.send()` lacked — the AI persona replies through it too),
  `botClient(message)` (the one documented `message.client` cast), member/channel
  resolvers as needed.
- `lib/grammar.ts` — a tiny Tracery-style `expand(grammar)`: composes *varied* sentences
  from interchangeable parts. Grammars are plain data (`symbol → rules`), so they're
  reusable, combinable (merge with spread), and accept a runtime symbol injected per call.

**Response composition (ports the old `responses.js`/`dataSpeech.js`/`generators.js` cleanly).**
Three reusable layers so flavour never gets hardcoded inside a command (the owner wants to
reuse/combine these): **data** — general vocabulary in `lexicon.ts` (adjectives, adverbs, nouns,
terms — reusable by the RPG too) + command-specific pools in `fun/` (`oracle.ts`, …), all
`as const` tuples; **generators** — `fun/generators.ts` fragment builders (`personalInsult`,
`accuracyPrefix`, `certaintyTerm`); **composer** — `lib/grammar.ts`. Pick by shape: a fixed
set of lines → `defineRandomResponseCommand`; a sentence that should *vary/assemble* → `expand`
+ lexicon + generators (`h!cost` is the worked example); fixed lines that must all agree with
**one** subject (you / a named person) → `lib/person.ts` (`personGrammar` — pronoun/verb forms,
the `h!love` example), *not* `expand` (which would pick a different person per token). The
command file stays a one-liner.

**Dead on arrival in TypeScript** — never reintroduce: the `checkIfString/Array/Int/...`
validator family, `convertByFunction`/`runFunctionOnAll` (array-or-scalar polymorphism),
`dcCheckIfMessage/Channel/Member` type guards (use discord.js `.isSendable()`,
`interaction.isButton()`, etc.), and stringly-typed dispatchers like `dcSendMsg(msg, c,
'reply')`. The type system replaces all of these. Helpers return real values and throw on
genuine errors — no silent `return undefined`.

Fun-command flavor data (word lists, response tables) lives in `src/fun/` as typed data
modules (D10); the command file stays thin (parse args → call `lib`/`fun` → reply).

**Adding a "pick a random line" troll command** = a data array in `src/fun/` + a tiny
declarative call to `defineRandomResponseCommand` (`commands/prefix/_randomResponse.ts`).
Options: `responses`, `extraResponses` (per-call dynamic lines), `funny` (append the
`, yes-yes` tic to non-URL replies). Used by `you`, `hate`, `is`. Commands with real
logic (`rate`, `who`, `dndalign`, `roll`, `choose`) stay hand-written `satisfies
PrefixCommand`. Adding a new *response* to an existing command is just one array line.

### Testing (Vitest)

- `*.test.ts` colocated next to the unit under test. The loader skips `_`-prefixed and
  `*.test`/`*.spec` files, so tests can live anywhere under `src/` safely.
- Pure logic is the priority to test: `lib/` (random, text, the `chunkMessage` splitter,
  `targetFromArgs`), `core/locks.ts` (mutual exclusion, deadlock-freedom, FIFO drain,
  release-on-throw), the command factory. Mock `Math.random` via `vi.spyOn` for
  deterministic randomness.
- discord.js objects are faked with a minimal `{ ... } as unknown as Message`; don't
  pull in a real client. ESLint relaxes `require-await` in `*.test.ts` (async test
  doubles that match a callback signature without awaiting).

## Concurrency model (the important part)

Problem: long interactive actions (turn-based combat, multi-step activities) must not be
corrupted by concurrent writes (hourly regen cron, other commands targeting the player),
and a player must not run two activities at once.

Solution — `CharacterLockManager` in `core/locks.ts`. Locks are keyed by
**`Character._id`**, not by Discord user id (D18): resources/AP/ELO live on characters,
NPCs (`ownerId: null`) must be lockable too (6C movement), and
`ActivitySession.participantIds` are character ids. "One user, one activity at a time"
is enforced separately, by the active-character switch guard
(`accountService.setActiveCharacter` refuses while either character is **busy** — in-memory
locked OR in an active `ActivitySession`, so it holds across restarts too — D22).

- `runExclusive(characterIds: string[], fn)` — acquires locks for all listed characters
  (**always sorted by character id** to prevent deadlocks), runs `fn`, drains each
  character's deferred queue, then releases. Draining happens **before** release, so a
  deferred op can never interleave with the next holder's critical section.
- `isLocked(characterId)` / `lockedIds()` — used by cron jobs to split bulk vs deferred work.
- `deferOrRun(characterId, op: () => Promise<void>)` — if the character is unlocked, run
  `op` immediately; if locked, push it onto that character's FIFO deferred queue (drained
  by the current holder just before it releases — see above). Deferred ops must be small,
  self-contained async functions performing atomic DB writes, and must never call
  `runExclusive` themselves.

Rules:

1. **Short auto-resolved actions** (sparring, fishing roll, a trade): acquire locks on all
   participants for the whole action, keep transient state **in memory**, commit the outcome
   at the end in a single service call. Never leave the DB half-committed mid-action — on
   crash, an in-progress *short* action is simply lost (accepted; it was sub-second). **Long,
   interactive, multi-step activities are different — see "Durable long activities" (D17).**
2. **Commands that do one atomic write** (give currency, single roll rewards): no lock
   needed if expressed as a clamped delta (D6). Use locks only for read-modify-write
   sequences or "must not interleave with an activity" semantics.
3. **Cron jobs**: bulk `updateMany` excluding `lockedIds()`, then `deferOrRun` an
   equivalent single-character op for each locked character. Nothing is lost; regen
   lands right after the fight ends — and always before the next lock holder starts.
   With durable activities the regen job actually writes **three** bulk-first groups
   (free / session-busy / locked-deferred) — see D23 for which resources tick where.
4. Locks are **in-memory only** (single process, single guild). They do not survive
   restarts — that's fine for short actions (rule 1) and intentional for long ones: a crash
   auto-releases the in-memory lock so a player is never stranded "busy forever"; the durable
   `ActivitySession` (D17) carries the real cross-restart state.

### Durable long activities (D17)

Anything that holds **accumulated state across player think-time** (turn-based duel,
multi-room exploration) must NOT keep that state only in memory. Instead:

- **`ActivitySession` doc** (`db/models/activitySession.ts`): `{ type, participantIds, step,
  status, state, expiresAt }`. It is both the saved per-step state *and* the cross-restart
  "this character is busy" lock (`getActiveForParticipant`). `state` is an opaque blob the
  activity's own code owns; the durability layer never interprets it.
- **Commit per step, not at the end.** Each player decision is one atomic
  `activitySessionService.advance(id, expectedStep, newState)` — a step-guarded update
  (`{_id, step:N, status:'active'} → $set state, $inc step`). The step guard makes a step
  **idempotent** against double-clicks *and* crash-replay: a stale/duplicate click finds the
  step already advanced and is safely ignored (returns null).
- **Stateless components** carry the `sessionId` in the customId (like the panel/comic), so
  buttons keep working after a restart — they re-resolve the session from the DB.
- **Reaping**: a **TTL index** on `expiresAt` (refreshed each step) deletes idle/abandoned
  sessions automatically. Per the D17 AP policy (charge at start; timeout ⇒ forfeit), a TTL
  delete needs no side effect; only a *clean cancel* runs a refund before `abandon()`.
- **Hang guard**: wrap long actions with a max lock-hold deadline and time out external calls
  (Discord/OpenAI) so a wedged step can't hold a player's lock forever.

**Consumers dispatch through the D22 registry** (`commands/components/_activities/`): a
handler per session type owns `render(session)` (current step from state — also used for
re-entry and stale-click repaints) and `onAction(...)`. The **`obstacle`** handler is the
reference implementation, including the **crash-safe completion choreography**: win the
final `advance` (the step guard doubles as a completion mutex) → run the idempotent side
effects (setLocation, chronicle) → delete the session; if the process dies in between,
`render` derives the terminal outcome from state and shows a "Press on" finalize button
that re-runs the idempotent tail. Activity *step logic* stays pure in `game/activity/`
(e.g. `obstacle.ts` reducer) so it's testable without Discord.

Seam + first consumer built; **real mechanics still wait for the ruleset** (D14) — the
obstacle rolls pure-random like sparring (D16). Next consumers: the serious `/smackdown
duel`, richer 6C encounters.

Core primitive (Phase 2, re-homed onto characters in 6A): `characterService.applyResourceDeltas(characterId, deltas)`
— aggregation-pipeline update that adjusts resources and clamps to `[0, max]` server-side.
Most of the bot should mutate characters only through the service. Sibling methods follow
the same atomic-pipeline pattern: `applyCurrencyDeltas` (clamp `>= 0`), `spendActionPoints`
(atomic check-and-spend), `regenAll` (bulk `updateMany` with a per-document pipeline — one
round trip for everyone), and `regen` (single-character deferred op).

Key technique: **aggregation-pipeline updates compose D6 and D7**. Because `updateMany`
accepts a pipeline that references each document's own fields (`$min`/`$max`/`$add` over
`$resources.<k>.current`), the hourly regen is one bulk write that computes a per-character
clamped result — no read-modify-write, no per-character round trips, no lost updates against
concurrent command writes. The same `$set`-map builder backs both single-doc and bulk
methods (`setStage` in `characterService`).

## MongoDB modeling notes

> The authoritative, always-current model lives in `RPG_SYSTEM.md`. This section keeps the
> *design rationale* (why the shapes are as they are); look there for concrete fields/values.

- Two collections (6A, D12): **`Account`** (one per Discord user, keyed by user id —
  settings + `activeCharacterId`) and **`Character`** (the game entity, keyed by its own
  **uuid**; player-owned or NPC via `ownerId: null`). `models/character.ts` shape is
  **derived from the content catalogs** (`game/data/{resources,attributes,skills,currencies}.ts`):
  the schema field maps, the `CharacterDoc` keys, and `defaultCharacterStats()` all read
  from those catalogs, so adding e.g. a currency happens in exactly one place. Each resource
  is stored as `{ current, max }`.
- **Resource `max` is stored, not derived on read.** `max` initializes from the catalog
  `defaultMax`; resources start full. Attribute-derived maxes (the old `getMaxHp = str/wp/t`
  formula) are a deliberate future step — a `recalculateMaxResources` seam — so the
  clamp/regen pipelines stay simple now and changing a max later is a recompute, not a
  migration. (Blocked on the Phase 7 ruleset — D14.)
- Only the two regenerating vitals (`health`, `stamina`) ship so far. Meters that *rise*
  over time (hunger, stress, etc. from the old schema) have inverted tick semantics and
  get their own job later; add them to `resources.ts` when built.
- **`attributes` and `skills` are intentionally modeled ahead of any consumer** (owner's
  decision, 2026-06-15): they exist on `Character` as the visible skeleton of the target
  game even though nothing reads them yet except the placeholder combat formula (`/profile`
  shows only AP/vitals/currencies). Do NOT "tidy them away" as unused — the Phase 7 ruleset
  will consume them.
- Free tier M0: 512 MB storage, shared cluster. Avoid per-message writes, avoid
  unbounded arrays (the old `gFishing.fish[]` grew without limit — cap or aggregate).
- The old schema in `OldBot/Tosche/modules/schematicsGuild.js` remains the **reference**
  for what the game tracked; redesign freely — it's a starting point, not a contract.

### Content vs state (D10)

Static content (fish species, item definitions, activity tables) is code, not DB data —
data modules under `src/game/data/` (game content) and `src/fun/` (word lists). Pure
data, no logic. Pattern:

```ts
export const FISH = {
   river_trout: { name: 'River Trout', rarity: 'common', minWeight: 0.2, maxWeight: 3.5 },
} as const satisfies Record<string, FishDefinition>;

export type FishId = keyof typeof FISH;
```

Rules:

1. Content ids are **stable slugs** (`'river_trout'`), never display names or array
   indices. Display names are free to change; ids are not.
2. Ids are **append-only**: once an id exists in any DB document, never rename or delete
   it without migrating the referencing documents.
3. Code that resolves an id from a DB doc must handle "unknown id" gracefully
   (log + fallback, not crash) — it signals a rename that skipped rule 2.
4. Instance documents store **only per-instance fields** (`fishId`, `weight`,
   `caughtAt`); static fields are resolved from code at read time. Exception: if a
   historical value must survive content rebalancing (e.g. sale price at time of sale),
   snapshot that one field into the document at write time.

## Theme / lore quick reference

- Races: canid, ermehn, felis, lutren, polcan, tamian, vulpin.
- The bot is **Tosche** on the server; the character is **Tosch**, "everyone's favorite
  BtWD general". Flavor text is in-character where it fits; the old bot sprinkled tics
  like ", yes-yes" / " lol" onto ~25% of fun responses (`additionalWordList1`) — keep
  that spirit.
- Old bot has large curated word lists (adjectives, classes, animals, weapons, places,
  Darkest Dungeon quotes...) in `OldBot/Tosche/bot.js` — port them as data modules into
  `src/fun/` when porting commands.

## OldBot reference (what to port, what to avoid)

`OldBot/Tosche/` is the previous JavaScript bot. Two generations coexist there:

- `bot.js` (~2600 lines): legacy giant `switch` with dozens of fun commands and inline
  word lists. **Port the command ideas and lists**, not the structure.
- `commands/{regular,guild,master,rp}/`, `events/`, `modules/`, `classes/`: the newer
  per-file architecture. Useful references: `events/messageCreate.js` (prefix routing,
  cooldowns), `modules/schematicsGuild.js` (schemas), `modules/commonGuild.js`,
  `commands/guild/*` (fish, smackdown, jail, leaderboards, profile — the game features
  to rebuild), `modules/chatGPT.js` (Phase 5 reference).

**Anti-patterns in OldBot — do not reproduce:**

- Busy-wait "transaction" loop (`cdWaitForAvailableTransaction` polling every 5 s) and
  the `MemberData.collector/transactionOpen` task system → replaced by `CharacterLockManager`.
- Global `fightInProgress` boolean (one fight at a time server-wide).
- Hardcoded ids and channel names in code (`'553933942193913856'`, `'smackdown-spire'`)
  → ids go to `.env` / config, channel references to a config map.
- Secrets in source: `bot.js:76` contains a commented-out MongoDB URI **with credentials**.
  Treat those as burned; never commit secrets.
- Mixed responsibilities (commands doing DB access directly, modules importing each
  other in a web).

## Idea backlog — to CONSIDER, not commitments

Proposals from the 2026-07-02 design review. **None of these is decided.** Each needs an
explicit owner "yes" before any work starts; when accepted, move it into the roadmap (and
the decision log if it sets a rule); when rejected, delete it here with a one-line why.
Several overlap the `RPG/` design project — coordinate there instead of deciding twice.

- **Ambient events** — rare, hard-throttled random encounters hooked into normal chat
  (a scuffle, a find, a Tosch challenge; reuses the ambient-AI seam + `silentChannels`).
  Rationale: on a ~10-person server the game must play *where people already are*; "go
  to the game channel" loops die. The single highest-leverage retention idea here.
- **Weekly co-op server event ("Defense of Deltrada")** — cron builds a threat during the
  week, weekend battle, everyone contributes actions (atomic `$inc` into an event doc);
  co-op vs environment beats PvP at this player count (no simultaneous presence needed).
  Also the natural **rate-limited AP sink** that keeps uncapped AP (D15) harmless.
  *(Overlaps `RPG/` P-arena "Trial/PvE" — same muscle, design once.)*
- **Titles/achievements** — an earned `titles[]` list displayed beside the self-chosen
  epithet ("the Carp-Slayer", "Punching Bag of Deltrada"). Social visibility is the best
  reward currency on a friends server and costs zero balance work. Pairs with the planned
  sparring-Elo removal (D16): rework the leaderboard to W/L + streaks + funny stats.
- **Tosch as a game actor** — feed game events (duel results, arena outcomes) and approved
  character bios into the AI persona so Tosch comments on and "knows" the cast; later,
  NPC dialogue with location context. AI stays flavor-only, never outcomes (`RPG/` R6).
- **Tavern gambling** — a dice game vs the house in the Sunken Tankard (canon has
  *Mearog* — see `RPG/` §11); small self-running coin sink, a reason to travel, and a
  simpler first `canCharacterAct` consumer than the duel.
- **Locations = activity tables** — treat as a 6C design constraint: travel is only worth
  building if each location has its own things to do (tavern = gambling/rest, plaza =
  market/gossip, spire = duels, river = its own fishing table). Otherwise `travel` is a
  button that renames a string.
- **Weekly DB backup job** — Atlas M0 has **no backups**; a cron dumping the collections
  to JSON and posting the file to an owner-only channel insures the whole game state for
  an hour of work. Cheap enough to just do early.
- **Seasons / "campaigns"** — optional 2–3-month themed arcs with their own leaderboards;
  winners keep permanent titles. Fights the "everyone is maxed, nothing to want" endgame
  of small servers — but resets can also demotivate casuals. Genuinely undecided; revisit
  once the RPG loop exists.
- **CI (GitHub Actions)** — run `build` + `lint` + `test` on push once the repo has a
  remote; replaces the manual pre-deploy gate (already noted as "move to CI eventually").

## Roadmap & status

**Current state (2026-07-03):** the core runtime, fun/admin command layer, AI persona and
moderation are live; the server-RPG is mid-build — the Account/Character *structure* exists
(6A/6B) but *mechanics* are blocked on the Phase 7 ruleset (D14). A full architecture review
hardened the seams (D18 lock keying + drain-before-release, status-guarded approval
transitions, side-effect-free `/profile` lookups, word-boundary moderation matching).
The **game foundations landed (D20–D24)**: the step-driven creation wizard, the location
graph + `/travel` (first `canCharacterAct`/AP consumer), the travel-encounter seam, the
activity-handler registry with the `obstacle` reference activity (first D17 consumer),
busy-aware regen, and the public chronicle channel.
**187 tests, build + lint green.** The owner has smoke-tested `/profile` and `/smackdown`
live; the bot has not yet been run end-to-end against a live Atlas cluster (needs `.env` +
`npm run deploy` — required again: `/travel` is a new slash command). See `RPG_SYSTEM.md`
for the concrete game model and what is still placeholder.

**What works today:**

- **Prefix (`h!`)** — *fun:* `choose`, `comic`/`btwd` (interactive browser), `cost`/`price`,
  `createname`, `dndalign`, `hate`, `is` (8-ball + verb aliases), `love`/`compliment`, `name`,
  `rate`, `resolve`, `syllables`, `who`, `you`, `amount`/`percent`/`chance`/`%` (made-up numbers),
  made-up measurements (`weight`/`mass`, `height`/`length`, `capacity`/`volume`, `size`, `when`, `where`),
  made-up reasons (`how`, `why`), roasts (`animal`, `race`, `class`, `whois`), `hug`, `rant`,
  `celebrate`/`party`, `mood`, `advice`/`therapy`, `weapon`/`weapons`, `ddquote` (Darkest Dungeon), converters
  (`ctof`, `ftoc`, `cmtoimperial`, `kgtoimperial`, `bmi`, `bmiforheight`); *utility:* `ping`,
  `roll`, `avatar`, `timestamp`, `help`/`commands` (auto-generated command list); *admin (ownerOnly):* `clear`,
  `directmessage`/`dm`, `messagechannel`/`mc`.
- **Slash (`/`)** — `character` (create/edit/race/submit/list/switch via the step-driven
  creation wizard + owner approval), `profile`, `smackdown sparring` (round-by-round in
  `#smackdown-spire`, commits Elo only), `travel` (location graph + encounters; approved
  characters only), `leaderboard`, `ping`.
- **Events** — `messageCreate` (banned-word check → `h!` routing → ambient AI),
  `interactionCreate` (slash + component routing), `clientReady` (starts jobs),
  `messageDelete`/`messageUpdate` (edit/delete log to `#espionage` — the delete log adds
  attachments + a best-effort "deleted by" from the audit log; edits are re-moderated),
  `guildMemberAdd`/`guildMemberRemove` (gate welcomes/farewells). Banned-word removals report
  the **exact match + its location** (and flag punctuation-collapsed matches as possible false
  positives), so a deletion is never a mystery.
- **Jobs** — `resource-regen` (hourly, lock- and session-aware bulk-first per D7/D23).
- **Component handlers** — `character` (creation wizard + approval petition), `comic`
  (browser), `activity` (generic durable-activity router + `_activities/` registry; first
  activity: `obstacle`).
- **Infra** — `CharacterLockManager` (`client.locks`), component-handler router
  (`client.componentHandlers`), `AiService` (`client.ai`, optional), `settings.ts` tunables,
  `game/chronicle.ts` (public game log — D24).

- [x] **Phase 0 — toolchain**: NodeNext, tsx (dev + prod), deps upgraded, `uuid`/`openai`/
      `dotenv` removed, empty base classes deleted.
- [x] **Phase 1 — core runtime**: ToscheClient, loader (commands/events/jobs), `h!` routing
      with cooldowns + `ownerOnly`, interactionCreate dispatch, error handling, graceful
      shutdown, `deploy-commands.ts`.
- [x] **Phase 2 — data layer**: DB connect, content catalogs, Character model + characterService
      (atomic-pipeline delta/regen), `/profile`, hourly `resource-regen` cron.
- [~] **Phase 3 — concurrency**: CharacterLockManager + deferred queues done & tested
      (`client.locks`), regen job lock-aware, `/smackdown sparring` is the first `runExclusive`
      consumer. *Remaining:* a genuinely interactive turn-based duel on buttons (D17 seam built).
- [x] **Phase 4 — port fun & admin commands + events** from OldBot. The command list above + the
      helper/data layers (`lib/{random,text,number,units,discord,grammar,person}`, `fun/*`, the
      response-composition trio + `lib/text` `countSyllables`/`pastTense`, the latter wired as the
      grammar `#verb.past#` modifier) + the edit/delete/member events. (`pasttense` folded into
      grammar — no command; `therapy` dropped.) Deliberately **not** ported: `guild/*` (the old
      RPG — superseded by Phase 6+), `rp/*` (Phase 8), and the `master/*` dev-only joke commands.
- [x] **Phase 5 — AI persona**: Tosch-styled replies (name-trigger / AI channel / ~1% ambient),
      behind `AiService`, optional via `OPENAI_API_KEY`.
- [~] **Phase 6 — Account ↔ Character split** (D12–D16): *structure only, no RPG mechanics (D14).*
      - [x] **6A** — Account + Character models, accountService/characterService, `/profile` +
            sparring + regen on characters, ELO/currencies per character, AP (no cap — D15) +
            `spendActionPoints` + `canCharacterAct`, `game/data/{races,locations}.ts`.
      - [x] **6B** — `/character` lifecycle + interactive creation panel + owner approval via
            `imperialDecrees` (petition + buttons + reject-reason modal), component-handler infra.
      - [x] **6B+** — game foundations (D20–D24): step-catalog creation wizard (panel renders
            from `creationSteps.ts`); locations graph + `/travel` (**first `canCharacterAct` +
            AP-spend consumer**) + encounter seam (flavor/activity); activity-handler registry +
            generic `activity` router + `obstacle` (**first D17 consumer**, pure-random per D16);
            session-aware switch guard; busy-split regen (D23); chronicle channel (D24).
      - [ ] **6C** — NPC seeding + NPC-movement cron along the graph (NPC = `Character` with
            `ownerId: null`); more locations + per-location activity tables (see backlog).
- [ ] **Phase 7 — RPG ruleset** — being **designed in `RPG/`** (d100 roll-under, roles +
      learn-by-doing skills, Wounds, Stress; see `RPG/Ruleset.md` + its decision log/forks).
      Code nothing until the relevant fork locks (D14); shipping it replaces the placeholder
      attributes/skills/combat and unblocks the serious `/smackdown duel`.
- [ ] **Phase 8 — pen-and-paper RP module** (separate `rp/` domain — D9).

When a phase lands, tick it here and note any decisions that changed. Detailed per-change
history lives in git, not in this file.
