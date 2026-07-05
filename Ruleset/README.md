# Ruleset/ — single source of truth for the server-RPG

This folder is **the** place to read and edit the server-RPG game model — both the *design*
(what the rule should be, and why) and the *implementation* (what is actually built, in
`ToscheBot`'s code, right now). Before this folder existed the same information was split
across three places that drifted apart: `RPG/Ruleset.md` (design), `RPG_SYSTEM.md`
(implementation) and `CLAUDE.md`'s decision log (both, mixed with unrelated bot-engineering
decisions). **Those are now historical/archived — read here instead** (see "Superseded
sources" at the bottom).

**Audience:** both the human owner and any AI assistant picking up work on the game. A topic
file should let either one understand *what the rule is*, *why it is that way*, and *how far
the code currently gets it*, without cross-referencing three other documents.

## How this folder is organized

One file per topic. **Every topic file has the same shape:**

1. **Ruleset** — the design: the rule as currently decided (or the leading proposal, if not
   yet locked), and the reasoning behind it. This is the "what should happen" layer.
2. **Implementation** — what exists in `src/` today: which models/services/files carry the
   rule, and how far it got (structure only? real numbers? not started?).
3. **Open questions** — what's still undecided, deferred, or waiting on the owner.

Status markers (used throughout, consistent with the old docs):
- ✅ **decided & built** — the rule is locked and the code implements it.
- ✅ **decided** / 🟡 **not built** — the rule is locked but code doesn't do it yet.
- 🟡 **placeholder** — code exists but the *numbers/balance* are not designed yet.
- ⬜ **planned** — not decided and not built.
- ❓→`Pn` — an open fork; see that topic file's "Open questions" section for the proposal.

Topic files:

| File | Covers |
|---|---|
| [character.md](character.md) | Account↔Character split, identity, the 8 attributes + racial bases + creation point-buy, the 7 races, approval lifecycle, the creation wizard, active-character switching |
| [skills.md](skills.md) | The skill-tree model, learn-by-doing growth, Roles, the points economy, talents |
| [combat.md](combat.md) | The core d100 test (shared by every system), difficulty ladder, Success Levels, opposed tests, Wounds/Soak/Downed, Fate points, Smackdown (sparring/duel/trial) |
| [world-travel.md](world-travel.md) | The location graph, travel, Action Points, living locations (weather/events/discoveries/stats), the game clock & conditions, travel encounters (multi-approach challenges), the chronicle |
| [items-equipment.md](items-equipment.md) | The item catalog, equipment slots, the carried pack, the stash (stored items), equip rules, encumbrance |
| [economy.md](economy.md) | Currencies, per-race currency/exchange (future), pricing |
| [flavor-progression.md](flavor-progression.md) | Deed traits, Stress→Madness, the "texture" menu (reputation, scars, cold, vice, hunger, combat morale) |

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
3. **Gritty but not cruel.** Low Wounds, real injuries, fast decisive fights — but **no
   permanent death** in the server game. Losing costs time and setback, never the character.
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
citation — verify specifics against the owner's canon docs before stating them as fact.

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
shape is locked; real combat (Wounds/Soak/Downed, the serious `/smackdown duel`); Roles and the
points/talent economy; Stress→Madness and the rest of the flavor menu; the economy layer
(per-race currencies, trade); NPC seeding/movement.

See each topic file's "Implementation" section for the precise ✅/🟡/⬜ breakdown, and its
"Open questions" section for what's still waiting on the owner.

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
| R3 | Gritty low-HP combat (Wounds in single/low-double digits; Fate points). | combat.md |
| R4 | Low fantasy = no player spellcasting. | README (pillars) |
| R5 | This project is the real ruleset for ToscheBot's server-RPG; ships into ToscheBot. | README |
| R6 | Bot-run world + Imperator-authored quests; AI = flavor/narration only, never outcomes. | README |
| R7 | Progression = fixed Roles + learn-by-doing skills + points-for-talents. | skills.md |
| R8 | No permanent death: 0 Wounds = Downed → infirmary → recovery, not AP loss. | combat.md |
| R9 | Flavor-rich attrition (Stress→Madness + texture systems) is a pillar. | flavor-progression.md |
| R10 | Core math = the summed skill-tree model; AV (never "AP") for armour; Wounds keep Willpower at half weight; a connecting hit deals ≥1 Wound; real-stakes PvP needs button-consent. | skills.md, combat.md |
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

New decisions get the next free number in whichever series makes sense (a design call →
next `R#`; keep this table and the topic file in sync in the same change) and are recorded in
the relevant topic file's Ruleset section, then indexed here.

## Open forks awaiting the owner

The old `RPG/Propositions.md` numbered forks (`P5`…`P18`, `P-skilltree`, `P-combat`, …) are
folded into each topic file's "Open questions" section, next to the rule they'd change, instead
of living on a separate decision board. `P-skilltree` is resolved (→ R11/D34); architecture forks
`P1`–`P4` are resolved (→ R5/R6/R7, see README above). Search a topic file's "Open questions" for
a `Pn` tag to find the original framing preserved.

---

## Superseded sources (archived, don't edit as if current)

The following files predate this folder and are **left in place, untouched, as history** — do
not treat them as the current source of truth, and don't add new content to them:

- `RPG/CLAUDE.md`, `RPG/Ruleset.md`, `RPG/Propositions.md`, `RPG/Examples.md`, `RPG/memory/` —
  the original design-project workspace. Fully folded into this folder's topic files.
- `RPG_SYSTEM.md` (repo root) — the original implementation-tracking doc. Fully folded into
  this folder's "Implementation" sections.

Root `CLAUDE.md` still owns the bot's engineering conventions and its own decision log for
non-game infrastructure calls (D1–D11, D14, D17, D18, D22–D24, D29, D30 and similar) — those
never moved.
