# Conversations — dialogue as a durable event

See [README.md](README.md) for the legend and the shared file shape.

A **conversation** is a scripted, multi-step exchange with an NPC (npcs.md). It is *not* a
separate engine: per R14 a conversation is a **durable dialogue `ActivitySession`** (root
`CLAUDE.md`'s D17/D22), so it reuses everything the travel `challenge` already proves —
per-step commit, crash-safe resume, stateless restart-proof buttons, and "dismiss the message
mid-dialogue and it's saved" for free.

---

## Reference (decided data & math)

**Model** — a dialogue is a graph of **nodes**; each node = one NPC line + a list of player
**options**. Held as a `dialogue` `ActivitySession`: `state = { dialogueId, nodeId, flags,
visited[] }`, one atomic `advance` per option chosen.

**Option shape** (`game/data/dialogues.ts`, ✅ built — the `requires`/`effects` families ship
incrementally as their systems land; see Implementation for what is live):

| Field | Meaning |
|---|---|
| `label` | player-facing line (shown with a `[tag]` when gated, e.g. `[Cruel]`, `[Persuade]`) |
| `requires?` | gate: `minTraits` (flavor-progression.md), `minRep` (factions.md), skill/attribute floor, item held, prior `flags` — reuses `world/conditions.ts` |
| `check?` | a `CheckDefinition` (combat.md) — `success`/`failure` route to different `next` nodes |
| `effects?` | on-pick deltas: `traitDeltas`, `repDeltas`, `flags` set, currency/item grants, Stress deltas |
| `next` | next `nodeId`, or `end` |
| `oneShot?` | option retires after being picked ONCE, success or failure (asked and answered — stricter than an encounter option, which only burns on failure) |
| `hidden?` | not shown until `requires` is met (a secret line), vs shown-but-disabled with a reason |

**Availability of the whole conversation** is itself a condition set (location, time, faction
rep, traits, quest flags) — the same `LocationCondition` language.

**AP / cost** — talking is cheap: a conversation costs **0 AP by default** (🟡); an option that
triggers a *check* may cost AP or a resource, since a check is a meaningful action (skills.md's
"only meaningful uses count").

---

## Ruleset

### A conversation is a kind of event, not its own system ✅ direction R14
The owner's framing (TODO): "conversations could be a type of event, rather than something
different." Decision: yes. A conversation is a `dialogue`-type `ActivitySession`, dispatched by
the same generic `activity` router + `_activities/` registry that runs travel challenges. This
buys three things with zero new infrastructure:
- **Standard saves on "dismiss message" mid-dialogue.** The ephemeral panel is stateless and
  the session commits per step, so dismissing (or a bot restart) never loses progress —
  re-opening the NPC (or `/play`) re-enters the current node exactly like a re-entered
  challenge (D22).
- **Crash-safety & double-click idempotency** come from the step guard already built.
- **"One live activity per player"** already holds — a conversation makes you *busy*, so you
  can't talk and travel at once (which is correct).

### Options gate on, and award, the character's inner + outer state ✅ direction R14
This is the payoff that makes dialogue matter rather than being a text dump:
- **Gated options** — an option can require a **deed-trait threshold** (`mercy ≥ 5`,
  `empathy ≥ 8` — flavor-progression.md), a **faction reputation** floor (factions.md), a
  **skill/attribute** floor, a **held item**, a **role** (skills.md), or a prior **flag**.
  Gated-but-visible options render with a `[tag]` and a disabled reason ("*Requires Mercy 5*");
  truly secret ones stay `hidden` until unlocked (the deep-layer surprise).
- **Check options** — an option can *be* a d100 check (Persuade/Deceit/Intimidate — Charisma
  branch; also Perception to read a lie, Intelligence to recall lore). Success and failure
  route to **different next nodes**, and a botched Deceit can cost reputation or anger the NPC.
- **Awarding options** — picking an option applies **trait deltas** (a menacing line →
  +Cruelty; sparing → +Mercy/+Empathy), **reputation deltas** (siding with the guard →
  +Deltrada Watch rep, −smuggler rep), **flags** (unlock later branches/quests), and optionally
  currency/items/Stress. This is a primary, low-friction way traits and reputation actually
  move — today only the drowning-stranger encounter moves traits at all
  (flavor-progression.md).

### Casual vs deep ✅ (the pillar-6 contract)
- **Casual** — read the NPC's line, click a lit-up option; the bot narrates outcomes. Trait/rep
  bookkeeping is invisible; gated options simply appear or don't. The bot can pre-select a
  "safe" default option so a casual can button-through.
- **Deep** — chase trait/skill/rep-gated branches, farm a relationship toward a quest unlock,
  read which lines are risky checks and pick the approach your build wins.

### Memory & consequences ✅ direction (numbers ⬜)
A conversation's `flags` persist (on the session while live; the *durable* ones the owner wants
remembered graduate to **character quest-flags** or an NPC **relationship** value — npcs.md).
So an NPC "remembers": greet a character you insulted differently, refuse a quest you failed,
open a branch only after you've done a favor. Keep this cheap — a small `flags` set / a single
relationship integer per (NPC, character), not a transcript.

### Relationship to quests ✅ direction
The Imperator (owner) authors most meaningful dialogue trees (README R6). A conversation is the
natural container for **quest-giving, quest turn-in, lore delivery, and branching moral
choices**. The bot supplies the engine + generic small-talk; the Imperator supplies the content.

---

## Implementation

✅ **Dialogue v1 is LIVE (PLAN S4, D45, 2026-07-10)** — exactly the four-piece build this
section named, template-first per AUDIT §3.4:

1. ✅ `game/data/dialogues.ts` — the node/option catalog (D10), **graph-test-validated**
   (`dialogues.test.ts`: every `next` resolves, every node reachable from `start`, rolled
   options declare a `failure` route, hidden options have a gate, `{placeholders}` known).
   Content: **`small_talk`** — ONE reusable template serving every archetype (greeting,
   per-archetype `{work}` function pointer via `WORK_LINES`, a repeatable rumor pool, a
   one-shot `[Persuade]` press for secrets) — plus **`marrek_tales`**, the single authored
   named-NPC tree (Marrek: lore node, persuade check, a `+cruelty` awarding line, a
   `[Courage ≥ 1]` visible-locked gate, a `heard_truth`-unlocked hidden toast `+honor`).
   Assignment: `NpcDefinition.dialogueId` (authored) else `ARCHETYPE_DIALOGUES[archetype]`.
2. ✅ `game/activity/dialogue.ts` — the pure reducer, mirroring `challenge.ts`
   (state-from-blob tolerance, per-option targets precomputed at session start for honest %,
   outcome lines stored in state so repaints are stable, terminal `resolution` derived-then-
   stored for crash-safe completion).
3. ✅ `commands/components/_activities/dialogue.ts` — the handler, registered by type
   `dialogue`; step-guarded `advance` per pick, side writes (traits via `applyTraitDeltas`,
   speechcraft via `creditSkillUse`, AP) ride the guard win; farewell finalize re-entry.
4. ✅ Start = the **`talk` hub action** (first live 'anywhere' action): read-only NPC picker
   (`play:talkto:<npc-id>` + a `play:hub` back button) → `performTalk` under the character
   lock (busy re-entry per D22, presence re-checked at click time). The encounter-launched
   dialogue seam remains open (an `activity` encounter with `activityType: 'dialogue'`).

**Gates live in v1**: prior `flags` + `minTraits` (evaluated purely against session state —
the trait snapshot is kept current by in-session awards; the DB write stays authoritative).
`minRep` (S5), item-held, skill/attribute floors and role gates are additive catalog fields —
add the field + one evaluator branch when their systems exist, no migration.
**Effects live in v1**: `traits` deltas + session `flags`. Rep/currency/item/Stress effects
wait on their systems (same additive path). **AP**: talking is free; a **rolled** option
costs `DIALOGUE_CHECK_AP_COST = 1` 🟡 (the "a check is a meaningful action" rule above —
also the anti-farm: training speechcraft is priced like training foraging).

**Two v1 shape decisions** (documented in `game/activity/dialogue.ts`):
- **Session flags are the ONLY memory** — they die with the conversation (the "Where flags
  live long-term" open question below stands; durable quest flags/disposition need an owner
  call).
- **The NPC is NOT a session participant**: talking never makes the NPC busy, so one player
  chatting up the merchant cannot lock the shop for everyone (and the regen job never sees a
  "busy" NPC over a chat). Revisit if a dialogue ever mutates NPC state mid-session (trade,
  disposition) — then the NPC must join `participantIds` and its lock.
- No chronicle: a mundane chat is nobody's news (D24 reserves the feed for the noteworthy).

Reused with no new infra: the generic `activity` router, the check engine, `applyTraitDeltas`,
`creditSkillUse` (D40), the D22 busy/re-entry rules, TTL reaping ("walk away = it lapses").

---

## Open questions

- **Where flags live long-term** — session-scoped `flags` are easy; the *remembered* ones need
  a home: a `character.questFlags` set, and/or a per-(NPC,character) relationship value
  (npcs.md). Keep it bounded (D32) — a flag set, not a log.
- **Small-talk vs authored trees** — should the bot generate throwaway ambient chatter
  (AI-narrated, README R6 flavor-only) distinct from Imperator-authored branching quests? Likely
  yes: two tiers, only the authored one moves traits/rep/quests.
- **Group conversations** — v1 is 1 character ↔ 1 NPC. Multiple players in one dialogue (a party
  parley) reuses the multi-participant session shape but complicates "who picks the option" —
  defer.
- **AP/Stress costs** — is any dialogue itself draining (an interrogation, a grim confession
  raising Stress)? Hook exists; numbers 🟡.
- **Timed / expiring dialogues** — an NPC offer that lapses if you walk away (session
  `expiresAt` already supports it) — flavor, decide per-content.

---

## Expansion ideas & risks

**Risks:**
- **Authoring cost is the real bottleneck, not the engine** (README's cross-cutting risk, sharpest
  here). A branching dialogue tree with gated/awarding options is expensive to write well, and
  content quality directly determines whether this whole system feels alive or skeletal. Before
  authoring many trees, prove the pattern is worth the cost with one or two genuinely good ones
  (a named NPC with real personality) rather than spreading effort thin across many shallow ones.
- **Gate-then-nothing risk** — an option gated on `minTraits`/`minRep` that's *never* reachable
  because the threshold is miscalibrated against realistic play (too high) silently wastes
  authoring effort and can never be noticed without playtesting data. Worth a lightweight owner-
  facing tool (even just a log line) flagging gated options nobody has ever seen.

**Expansion ideas:**
- **AI-assisted first-draft authoring, never AI-decided content** (stays inside R6's flavor-only
  rule for the *runtime* persona, but nothing stops using AI as an **offline authoring aid**): the
  Imperator could prompt for a rough dialogue-tree skeleton (nodes + plausible options) and then
  hand-edit/approve it before it ever ships — speeds up the single-owner bottleneck without any
  AI ever choosing an outcome at runtime.
- **Dialogue as an encounter payload was already designed in** (world-travel.md) — extend that:
  a *quest turn-in* could itself be framed as an encounter-triggered conversation, so returning to
  a location with a completed objective naturally opens the right dialogue node, no separate
  "turn in quest" command needed.
- **Voice/tone presets per NPC** (gruff, formal, cryptic) as a small enum feeding how the bot
  renders a node's line — lets one engine produce distinctly-feeling NPCs without bespoke prose
  logic per character, useful once npcs.md's generic-extras tier needs personality cheaply.
