# Ruleset/ — single source of truth for the server-RPG

This folder is **the** place to read and edit the server-RPG game model — both the *design*
(what the rule should be, and why) and the *implementation* (what is actually built, in
`ToscheBot`'s code, right now). Before this folder existed the same information was split
across three places that drifted apart: `RPG/Ruleset.md` (design), `RPG_SYSTEM.md`
(implementation) and `CLAUDE.md`'s decision log (both, mixed with unrelated bot-engineering
decisions). **The first two no longer exist — deleted after migration — read here instead**
(see "Superseded sources" at the bottom).

**Audience:** both the human owner and any AI assistant picking up work on the game. A topic
file should let either one understand *what the rule is*, *why it is that way*, and *how far
the code currently gets it*, without cross-referencing three other documents.

## How this folder is organized

One file per topic. **Every topic file has the same five-part shape** (the owner's "raw data on
top, explanations after" request):

0. **Reference (decided data & math)** — the terse, authoritative dump at the **top** of the
   file: the decided values, catalogs (name + what each does), and formulas/math, with **no
   rationale**. This is the "what we have, raw" layer — read this first to know the numbers; read
   Ruleset below for *why*. Where a value is still a placeholder it's marked 🟡 here too.
1. **Ruleset** — the design: the rule as currently decided (or the leading proposal, if not
   yet locked), and the reasoning behind it. This is the "what should happen / why" layer.
2. **Implementation** — what exists in `src/` today: which models/services/files carry the
   rule, and how far it got (structure only? real numbers? not started?).
3. **Open questions** — what's still undecided, deferred, or waiting on the owner: a fork with (at
   least) two named directions, framed and ready for a decision.
4. **Expansion ideas & risks** — the informal, ongoing "notebook" section: unprompted proposals
   for making a system richer (not yet a decision, not even necessarily a good idea — a place to
   park it before it's lost), and named risks/problems with the *current* design as written (a
   thing that could go wrong or feel bad in play, not a missing number). Unlike "Open questions,"
   nothing here needs to be resolved before building — it's read, not blocking.

Status markers (used throughout, consistent with the old docs):
- ✅ **decided & built** — the rule is locked and the code implements it.
- ✅ **decided** / 🟡 **not built** — the rule is locked but code doesn't do it yet.
- 🟡 **placeholder** — code exists but the *numbers/balance* are not designed yet.
- ⬜ **planned** — not decided and not built.
- ❓→`Pn` — an open fork; see that topic file's "Open questions" section for the proposal.

Topic files:

| File | Covers |
|---|---|
| [character.md](character.md) | Account↔Character split (+ server-wide units/country/timezone settings), identity, the 8 attributes + racial bases + creation point-buy + **skill-gated XP raises**, the 7 races + **signature talents**, **body/weight/height/age/shape**, physical & mental state, likes/dislikes, movement speed, approval lifecycle, the creation wizard |
| [skills.md](skills.md) | The skill-tree model, learn-by-doing growth, Roles, the **XP economy** (skill-gated attribute raises), talents + their requirement types, the skill panel |
| [combat.md](combat.md) | The core d100 test (shared by every system), difficulty ladder, Success Levels, opposed tests + criticals/fumbles, **Health pool + hit-location trauma tally** (replaces Wounds), Soak + **armour ✕ weapon-type**, Downed, Fate points, combat styles + counter-play, named moves, **auto-resolve v1 / manual later**, positioning+terrain (future), Smackdown (sparring/duel/trial, armed & unarmed) |
| [world-travel.md](world-travel.md) | The location graph, travel, Action Points, living locations (weather/events/discoveries/stats), the game clock & conditions, travel encounters (multi-approach challenges), the chronicle |
| [items-equipment.md](items-equipment.md) | The item catalog, equipment slots, the carried pack, the stash (stored items), equip rules, encumbrance, **quality tiers**, **material composition** |
| [economy.md](economy.md) | Currencies, per-race currency/exchange (future), pricing, haggle × reputation |
| [flavor-progression.md](flavor-progression.md) | Deed (personality) traits, Stress→**insanity**, the "texture" menu (scars, cold, vice, hunger, combat morale) |
| [factions.md](factions.md) | Factions + per-character **reputation**, tiers, racial baselines, relation-spillover, what rep gates |
| [conversations.md](conversations.md) | **Dialogue** as a durable multi-step event: options gated on / awarding traits/rep/checks, memory, quests |
| [professions.md](professions.md) | **Foraging** (identification + misidentification), **fishing**, **gardening**, **cooking** (flavor/texture/likes) |
| [npcs.md](npcs.md) | **NPCs** = `ownerId:null` Characters: seeding script, hourly behavior CRON, trade, teaming, conversation |

Engineering conventions that are *not* game rules (tech stack, concurrency model, file layout,
how commands/components/services are wired) stay in the root [`CLAUDE.md`](../CLAUDE.md) —
this folder is about *what the game is*, not *how the bot is built*.

---

## Design pillars ✅ (locked — everything below must serve these)

From the working agreement with the owner (Ravandel): the simulation underneath should be
**deep and realistic**, with plenty of room to min-max; the surface a casual player touches
should stay **simple** (pick a few things, press a few buttons). Concretely:

1. **One mechanic: d100, roll-under.** Everything risky is the same test — see combat.md's
   "Core test" section. Your **Effective** skill *is* your % up to ~95; past 100 it's
   **Mastery**.
2. **Roles + learn-by-doing, not levels.** A role (guard, tavern keeper, craftsman…) is your
   identity, chosen ~once. Skills rise through use. Points bought with skill-ups/quests buy
   talents. No XP-level treadmill, no WHFRP career ladder.
3. **Gritty but not cruel.** A legible Health pool with **hit locations** (R12 — not the old low
   Wounds pool), real injuries, fast decisive fights — but **no permanent death** in the server
   game. Losing costs time and setback, never the character.
4. **Persistent & asynchronous.** A living server, not a sit-down session. Actions cost
   **Action Points** (uncapped, accrue hourly) — nobody is "at the table."
5. **Flavor-rich realism.** Systems a lean game would cut — Stress→Madness, scars,
   reputation, cold — are *features* here. They must always stay auto-managed for casuals.
6. **Two layers, one contract.** Casual = race + role + name, then stance + button. Deep =
   manual points, loadouts, called shots, treatments, trade. **The bot always has a sensible
   default for every single choice** — if a system can't be auto-resolved to a reasonable
   default, it isn't finished. When proposing a mechanic, state how it appears in *both*
   layers; if it can only exist in the deep layer, it must be skippable with a good default.

Not 1:1 WHFRP: percentile tests and the gritty low-HP tone are borrowed, the rest (roles
instead of careers, use-based skill growth, no permanent death, uncapped async Action Points)
is the owner's own design. This project is a **modified version of BtWD canon**: diverging is
the owner's call, but getting a canon fact wrong by accident is not — say so when unsure. The
full sourced canon lives in the owner's separate lore project (not in this repo).

## Setting — Beyond the Western Deep

*Beyond the Western Deep* (BtWD) by Alex Kain & Rachel Bennett: a **low-fantasy**, medieval-ish
world of anthropomorphic animal nations — **no magic** (see skills.md's "Magic stance"), an
"anthropomorphic *Game of Thrones*": fragile peace, political backstabbing, racial tension,
history written by the victors. The continent is **Dunia**: the **Four Kingdoms** (Aisling/
canid, Sunsgrove/tamian+lutren, Navran/vulpin, Kishar/felis) plus two **stateless** peoples
(ermehn, polcan). The calendar runs the *Era of Reason* then the *Civilized Era* (the comic
opens in CE 249).

**The setting's core wound:** the Canid of Aisling fabricated the **Ermehn War**, drove the
Ermehn from their homeland into the Northern Wastes, and still hunt them; the exiled Ermehn
(e.g. the revived Sratha-din) resist. This tension is the natural seed for faction reputation
(flavor-progression.md) and quest content once the Imperator starts authoring it.

Each race also has its own canon **currency** — canid obsidian chips, tamian amber drops,
lutren pearl flakes, vulpin silver coins, felis gold — reserved for economy.md's future
regional-currency/exchange layer, not the single shared currency the game ships with today.

Seven playable races: `canid, ermehn, felis, lutren, polcan, tamian, vulpin` — see
character.md for their mechanical modifiers. The niches in that table (militaristic Aisling
army, Kishar scholars, Sunsgrove scouts/seafarers, Navran cosmopolitans/nomads, stateless
exiles, stateless raiders) are a *design* starting point informed by canon, not a lore
citation — verify specifics against the owner's canon docs before stating them as fact. Two
canon proper nouns worth remembering if quest/dialogue content (conversations.md) ever names a
place or institution: Kishar/felis's scholarly landmark **the Spire of Gair**, and Navran/
vulpin's governing body **the Council**.

## Relationship to the rest of ToscheBot

This ruleset **is** ToscheBot's server-RPG game model — not a separate game. It replaces the
placeholder attributes/skills/combat that the bot shipped with while the ruleset was being
designed (root `CLAUDE.md`'s old "Phase 7" framing). A **separate, later** pen-and-paper
voice-chat campaign (root `CLAUDE.md` D9) is out of scope here and shares no models with this.

The world is run by the **bot** (exploration, travel, encounters) plus the **Imperator**
(the owner, as admin — authors quests/rewards by hand). The AI persona (Tosch) is
**flavor/narration only** and never decides outcomes — dice and rules decide, the AI describes.

## Status at a glance

**Built and real, not placeholder:** the Account↔Character split, the approval lifecycle, the
creation wizard, the 8-attribute set with racial bases + point-buy, the d100 check engine, the
skill-tree model (structure — content is a prototype), deed traits (shape), the location graph
+ travel + living locations + multi-approach travel challenges, the inventory/equipment
prototype + the stash, one currency, Action Points (no cap), the chronicle, durable
activity sessions (the infrastructure future duels will reuse), for-fun sparring with ELO.

**Still placeholder or missing:** almost every *number* (resource maxes, AP costs, difficulty
values, damage/soak, item stats, growth rates) — these wait on playtesting once each system's
shape is locked; real combat (the R12 Health-pool + hit-locations model, Soak/Downed, the serious
`/smackdown duel`); Roles and the XP/talent economy; Stress→insanity and the rest of the flavor
menu; the economy layer (per-race currencies, trade); NPC seeding/movement.

**Newly *designed* (2026-07-05), not yet built — R12–R22 / this batch:** the Health-pool + hit-
location combat model (drops Wounds), armour ✕ weapon-type, criticals/fumbles, combat styles +
counter-play + named moves; skill-gated XP attribute raises + talent requirements + the skill
panel; **factions & reputation**; **conversations** (dialogue events); **professions** (foraging
with (mis)identification, fishing, gardening, cooking's flavor engine); **NPC** simulation;
server-wide account settings (units/country/timezone); character body/age/state/likes/movement;
fate points. These are **design only** — the "Implementation" section of each file says ⬜.

See each topic file's "Reference" section for the decided data/math at a glance, its
"Implementation" section for the precise ✅/🟡/⬜ breakdown, and its "Open questions" section for
what's still waiting on the owner.

---

## Decision log

Numbered decisions that are locked (design **R#**, mirroring the old `RPG/CLAUDE.md`'s log;
bot-engineering **D#** entries that are pure infrastructure, not game rules, stay in root
`CLAUDE.md` and aren't duplicated here). Each topic file links back to the entries relevant to
it; this table is the chronological master list.

| # | Decision | Where it lives now |
|---|---|---|
| R1 | d100 roll-under with Success Levels is the core resolution. | combat.md |
| R2 | Career-based progression, no XP levels — superseded by R7 (Roles). | skills.md |
| R3 | Gritty low-HP combat (Wounds in single/low-double digits; Fate points). *(pool reframed → legible Health + hit locations by R12.)* | combat.md |
| R4 | Low fantasy = no player spellcasting. | README (pillars) |
| R5 | This project is the real ruleset for ToscheBot's server-RPG; ships into ToscheBot. | README |
| R6 | Bot-run world + Imperator-authored quests; AI = flavor/narration only, never outcomes. | README |
| R7 | Progression = fixed Roles + learn-by-doing skills + points-for-talents. | skills.md |
| R8 | No permanent death: 0 Health (or a vital critical injury — R12) = Downed → infirmary → recovery, not AP loss. | combat.md |
| R9 | Flavor-rich attrition (Stress→Madness + texture systems) is a pillar. | flavor-progression.md |
| R10 | Core math = the summed skill-tree model; AV (never "AP") for armour; ~~Wounds keep Willpower at half weight~~ *(dropped by R12 — a legible Health pool needs no Willpower padding)*; a connecting hit deals ≥1 damage; real-stakes PvP needs button-consent. | skills.md, combat.md |
| R11 | The skill-tree model (R10) is BUILT in ToscheBot (2026-07-05) — structure locked, numbers still 🟡. | skills.md |
| D12 | Account ↔ Character split; currencies/ELO live per character. | character.md |
| D13 | Characters have an approval lifecycle (draft→pending→approved/rejected). | character.md |
| D15 | Action Points: no cap, accrue hourly even while busy. | world-travel.md |
| D16 | Smackdown has two tiers: for-fun sparring (built) vs a future serious duel. | combat.md |
| D19 | One currency (`deltradaCoins`) until the economy layer exists. | economy.md |
| D20 | Character creation is a step-driven wizard over the draft doc. | character.md |
| D21 | The world is a data-driven location graph with a travel-encounter seam. | world-travel.md |
| D25 | Eight attributes with hardcoded racial bases + a creation point-buy. | character.md |
| D26 | Travel encounters are multi-approach challenges resolved by d100 checks. | world-travel.md |
| D27 | Account-level settings on `Account`; `/profile` = account, `/character view` = sheet. | character.md |
| D28 | Inventory & equipment prototype (WHFRP-flavored). | items-equipment.md |
| D31 | Locations live: static catalog + dynamic `LocationState` + derived presence. | world-travel.md |
| D32 | Persistence follows access pattern: embed bounded+hot-path, split unbounded. | skills.md, items-equipment.md |
| D33 | Owned items are two-tier: embedded carried pack + a separate `Item` collection (the stash). | items-equipment.md |
| D34 | Skills are arbitrary-depth trees in code; a character stores a sparse flat node map. | skills.md |
| R12 | Drop the low "Wounds" pool for an intuitive **Health-points pool** (never split per location — a per-location trauma **tally** drives critical injuries instead, limbs ~50%/vitals ~30% thresholds). | combat.md, character.md |
| R13 | **Attribute growth is skill-gated + XP-bought**: training attribute-tied skills unlocks buying *that* attribute with XP; XP also buys talents. | skills.md, character.md |
| R14 | **Conversations** are durable multi-step dialogue sessions; options gate on checks/traits/rep/items and award traits/rep/flags. | conversations.md |
| R15 | **Factions & reputation** — per-character public standing (racial baselines, relation-spillover) gates prices/access/quests/dialogue. | factions.md |
| R16 | **Peaceful professions** (foraging/fishing/gardening/cooking) = skill-tree gather→produce loops; foraged items can be **unidentified & misidentified**. | professions.md |
| R17 | **Food model** — flavor/texture/hidden-trait stats + **likes/dislikes** drive a dish's benefit; meals are dynamically-composed instances. | professions.md, character.md |
| R18 | **NPCs** = `ownerId:null` Characters simulated by an hourly behavior CRON; seeding script; trade, teaming, conversation. | npcs.md |
| R19 | **Account settings are server-wide** (units metric-in-DB/imperial-on-display, country, timezone), not game-scoped. | character.md |
| R20 | **Character body & condition** — weight/height → derived body-shape (**Size dropped**), age affects stats, physical & mental state, movement speed. | character.md |
| R21 | **Fate points** (reroll / dodge knockout) and **Stress → insanity points** (treatment-only removal; gaining risks a mental disadvantage); **criticals/fumbles on doubles** adopted. | combat.md, flavor-progression.md |
| R22 | **Racial signature talents** always applied to checks/combat (check affinity and/or a special effect). | character.md |
| R23 | **Item quality is a universal 0–4 tier NUMBER; the display NAME is resolved per item family** (a sword's "Masterwork" ≠ a fish's "Prize Catch"). | items-equipment.md |
| R24 | **Combat resolution v1 = auto-resolve** (pre-fight stance/style/target menu, one narrated pass, no per-round input); **manual turn-by-turn control is a later, additive upgrade**, not v1. | combat.md |
| R25 | **Positioning grid + terrain tags** (cramped rooms block 2H weapons, sand hinders footwork styles) — designed direction, explicitly deferred until after R24's manual mode exists. | combat.md |

New decisions get the next free number in whichever series makes sense (a design call →
next `R#`; keep this table and the topic file in sync in the same change) and are recorded in
the relevant topic file's Ruleset section, then indexed here.

## Open forks awaiting the owner

The old `RPG/Propositions.md` numbered forks (`P5`…`P18`, `P-skilltree`, `P-combat`, …) are
folded into each topic file's "Open questions" section, next to the rule they'd change, instead
of living on a separate decision board. `P-skilltree` is resolved (→ R11/D34); architecture forks
`P1`–`P4` are resolved (→ R5/R6/R7, see README above). Search a topic file's "Open questions" for
a `Pn` tag to find the original framing preserved. The `Pn` tags are just historical labels now —
the source files that defined them no longer exist (see below).

## Cross-cutting expansion ideas & risks

Per-topic ideas/risks live in each file's own "Expansion ideas & risks" section. A few don't
belong to one file — they're about how the systems interact:

- **Content-authoring bottleneck is the real scaling limit, not code.** R14 (conversations), R16
  (professions), R18 (NPCs) and R15 (factions) all lean on the Imperator hand-authoring trees,
  dialogue, roster entries and quests — a single person. Before building all four, consider which
  gives the most *playable content per hour authored*: a generic system that reuses the same 3
  dialogue nodes for every merchant NPC beats 10 bespoke trees nobody has time to write.
- **Five meters now describe "who a character is"**: deed traits (flavor-progression.md),
  faction reputation (factions.md), Stress/insanity (flavor-progression.md), likes/dislikes and
  physical/mental state (character.md). They're deliberately kept conceptually distinct (inner
  deeds vs public standing vs mental wear vs taste vs body), but nothing stops two of them
  drifting into overlapping mechanical effects if authored independently (e.g. does a disliked
  meal *also* nudge Stress, or only satisfaction?). Worth a single arbitration pass once 2–3 of
  them are actually built, rather than each file inventing its own rule for the boundary.
- **Casual-UI overload** — this batch alone adds combat styles + hit locations + named moves,
  reputation, dialogue options, profession gather-loops, and NPC interactions, each with its own
  buttons/selects. Individually each stays inside the two-layer contract (README pillar 6), but a
  hub screen showing all of them at once for one location risks becoming unreadable. Worth an
  explicit UI budget per screen (e.g. "no more than 5 primary buttons, rest behind a submenu")
  once 2–3 of these systems actually render side by side.
- **Self-driving economy is the riskiest coupling.** If NPC-produced goods (npcs.md) actually
  stock merchant shelves (economy.md) that professions (professions.md) also harvest from and
  factions (factions.md) price-modify, that's four systems whose *numbers* all lean on each
  other; a bug or an unbalanced rate in any one can starve or flood the whole loop. Recommend
  building each with a hard hand-authored fallback/cap first (a shop that never truly empties,
  a harvest rate that can't be zeroed by griefing) before trusting the chain end-to-end.

---

## Superseded sources (deleted — verified fully migrated first)

The following files predated this folder, were fully folded into it, and were **deleted on
2026-07-05** after a full content audit confirmed nothing substantive was lost (a couple of
loose canon nouns — "Dogged" as the polcan signature trait, felis's "Spire of Gair" landmark,
vulpin/Navran's "the Council" — were ported into this folder's files first; see character.md's
race table and this file's "Setting" section):

- `RPG/CLAUDE.md`, `RPG/Ruleset.md`, `RPG/Propositions.md`, `RPG/Examples.md`, `RPG/memory/` —
  the original design-project workspace. Fully folded into this folder's topic files.
- `RPG_SYSTEM.md` (repo root) — the original implementation-tracking doc. Fully folded into
  this folder's "Implementation" sections.

If you find a citation anywhere (root `CLAUDE.md`'s decision log, a topic file's prose) still
pointing at a path under `RPG/` or at `RPG_SYSTEM.md`, it's a stale reference from before the
deletion — the content it pointed to is here, in the relevant topic file, not lost.

Root `CLAUDE.md` still owns the bot's engineering conventions and its own decision log for
non-game infrastructure calls (D1–D11, D14, D17, D18, D22–D24, D29, D30 and similar) — those
never moved.
