# Skills — the skill-tree model, growth, Roles, points & talents

See [README.md](README.md) for the legend. This is the R10/R11/D34 skill-tree model — the
project's biggest single mechanic and the reference for how "sum along a tree" reads for both
crafting and combat.

---

## Reference (decided data & math)

**Core sum** — `Effective = attributeBlend(weighted) + Σ points(every node root→leaf) [+ extraNodes]`.
Uncapped; the **roll** clamps to a d100 % `[5,95]` (combat.md), not Effective.

**Attribute blend** — a node's `attributes: {STR:0.25, CHA:0.25,…}`, **inherited** from the
nearest ancestor that declares one, **overridable** per node.

**Mastery** — every **+20 Effective over 100 = +1 banked Success Level** (quality/damage) and
cancels difficulty. Below 100 a point is worth ~2× a point above 100. `SKILL_NODE_CAP = 100`.

**Storage** — `Character.progression.skills: Partial<Record<SkillNodeId,{points,progress}>>` —
**sparse** (absent = 0), embedded (bounded + hot-path, D32). `progression` also holds (⬜)
`talents`, `points`, and the R13 `xp` / attribute-raise state.

**Growth (learn-by-doing)** — one meaningful use → `creditUse` credits +1 use to **every node on
the path**, each converting uses→points at its `GROWTH_PROFILES` rate (🟡: root 10→50→200,
branch 10→30→100, leaf 5→20→60 uses/pt; steepens with points). "Meaningful" = contested / had a
real cost.

**Attribute growth (R13)** — skills don't raise attributes directly; **using attribute-tied
skills unlocks buying that attribute with XP**. Only attributes fed by trained skills unlock.
XP also buys **talents**. (Cost curve 🟡; must be steep — attribute double-dip, character.md.)

**Talent requirement types (R13/owner)** — a talent may gate on any of: **skill node ≥ N**,
**attribute ≥ N**, **race**, **deed-trait ≥ N** (flavor-progression.md), **faction rep**
(factions.md), or an **in-game achievement/flag**.

**Prototype trees shipped** — Smithing, Metallurgy, Speechcraft, Athletics (real, used); Melee/
Ranged/Brawling roots (stubs, unused). Content + numbers all 🟡.

**Target breadth** — ~30 top-level trees, Basic vs Advanced (Advanced needs ≥1 point to attempt).

---

## Ruleset

### Skills are trees, not flat levels ✅ model *(was P-skilltree — locked & built)*
A top-level skill (Smithing, Melee, Speechcraft…) is not one number — it's the **root of a
tree**: a general parent branches into specialisations (Smithing → Weaponsmithing →
Bladesmithing/Axesmithing), to arbitrary depth. **A parent gives every child a baseline, but
parent alone is never enough** — 100 Smithing with 0 Bladesmithing still forges badly; you
need the leaf *and* the attribute. Casually this is invisible: click "Forge → Sword," the bot
sums the whole path and rolls.

### The core sum ✅
```
Effective = (governing attribute blend, weighted)  +  Σ(points on every node, root → leaf)
```
- The **attribute term** is a **weighted blend**, not always a single stat: e.g. Intimidate =
  `0.25·Strength + 0.25·Charisma` (half presence, half muscle) while its sibling Persuade under
  the same Speechcraft parent is pure Charisma. A blend is set once on an ancestor and
  **inherited down**; a leaf overrides only when it genuinely differs.
- **Extra/material paths**: a recipe can sum more than one tree at once — a longsword sums the
  Smithing→Bladesmithing path *and* the Iron-Metallurgy path, because the *material* matters as
  much as the *craft*.
- **Uncapped on purpose.** Effective can run past 100 — that surplus is what makes crafting
  quality tiers and combat Mastery mean something (see below and combat.md). The **roll**
  (success chance) is what clamps to a d100 %, not Effective itself.

### Mastery — Effective over 100 ✅ shape / 🟡 rate
The d100 roll caps at 95% (`00` always fumbles), so skill past 100 buys no more raw hit-chance.
Instead, every **+20 over 100 = +1 bonus Success Level**, banked into the result — quality when
crafting, damage/margin in combat — and it **cancels difficulty** (a Punishing −30 barely dents
a 130-skill master). This is a deliberate soft-cap: below 100 a point is worth roughly twice as
much (via the target's tens digit) as a point spent past 100. Mastery is meant to be hard-won.

### Learn-by-doing, with anti-grind baked in ✅ shape / ⬜ exact math
Skills rise **through use** (Elder-Scrolls style): every meaningful, contested use of a skill
earns progress toward its next point. This is the casual engine — you just play, and you grow.
Two rules keep it from being a dummy-grinding contest:
- **Diminishing returns.** Each rank needs more uses than the last (steeper bands as points
  climb) — a root crawls, a leaf rises fast, but every node eventually walls up hard.
- **Quality-gated caps, per node.** *How* you practise caps *how far* practice alone takes that
  node: a home forge caps Bladesmithing around 40, a master's workshop/instructor around 70,
  and only real commissions at the edge of your ability push it past that toward Mastery. Same
  shape for combat nodes (a dummy < sparring < a real fight). **⬜ Not built**: only the
  diminishing-returns growth bands exist in code today; the practice-source cap tiers (home vs
  workshop vs commission) are still a design intent, not a mechanic.
- **Only *meaningful* uses count** — a bot-checkable rule: the action had a real cost or a
  chance of failure (an opposed/contested test, or a craft that consumed materials + AP at
  non-trivial difficulty). Free auto-successes and dummy-spam grant ~nothing, and the bot
  should always tell the player when an action "counted," so growth never feels arbitrary.

### Roles — identity, chosen ~once ⬜ not built *(was P12)*
A **Role** (Guard, Tavern Keeper, Craftsman, Soldier, Scout, Healer, Trader, Scholar…) is not a
treadmill — it's a package:
- **Special actions** only that role can take (a Guard: Patrol/Arrest; a Tavern Keeper:
  Brew/Host; a Craftsman: Forge/Repair) — verbs, lore, and standing.
- **Growth modifiers** — a role's own skills train faster / cap higher; off-role skills train
  slower. This is what makes a role *mean* something without locking a player out of anything.
- Changing role is possible but **rare** — it needs a real in-fiction reason and a cost, so it
  reads as an identity, not a respec button.

This is the "simple layer" creation shortcut too (character.md): race + role + name should be
enough to start playing, with the bot filling starting skills/gear from the role template.
**Open, not yet decided:** the launch list of roles and each one's special actions; how big the
growth-rate/cap bonus is; whether "civic" roles (Tavern Keeper, Craftsman) and "adventuring"
roles (Soldier, Scout) are one list or two axes a character can hold at once.

### Points / XP — the deliberate min-max layer ✅ direction R13 *(was P13, sharpened by the owner)*
Earned as **experience points (XP)** from skill-ups, quests and milestones — **not from each
individual use** (that would reward farming trivial actions; learn-by-doing already rewards use
via skill *progress*). XP is spent on two things:

- **Talents** (below) — the main sink.
- **Attribute raises — but gated by skill use (the owner's model).** Attributes don't rise by
  use directly; instead **training skills tied to an attribute unlocks the option to raise that
  attribute with XP**, and *only* those attributes. Concretely: each attribute tracks the skill
  progress feeding it (via the nodes' attribute blends — a node with `{STR:0.25,AGI:0.25}` feeds
  both); once the character has trained STR/AGI-rooted skills past a threshold, the character
  panel opens a **"+Strength / +Agility"** button, and spending XP there raises the attribute.
  A character who has only ever talked and read cannot buy Strength — they haven't earned the
  *right* to, only the mind stats they've exercised.
  - **Why this is the right shape:** it answers the ⚠️ **attribute double-dip** warning
    (character.md) not by pricing alone but by **gating** — you can't just dump XP into the
    globally-best attribute; you must have *played* into it. A blacksmith gets stronger, a
    duelist quicker, a scholar sharper. XP raises must **still be priced steeply / thresholded**
    on top (raising an attribute is a big deal), but the gate is the primary defence against
    every build converging on "buy Agility."
  - Implementation sketch: `progression` gains `xp` and a per-attribute **unlock/threshold**
    derived from the summed points on that attribute's tree(s); a `characterService.raiseAttribute`
    seam checks unlock + XP, then bumps `attributeAllocation` (reusing the existing rebase-safe
    field, character.md) atomically.

Casual: a **"Recommended"** button one-click-spends XP on role-appropriate talents (and the
obvious attribute raises) — never touch a number. Deep: hand-pick talents, plan which attributes
to unlock and raise, chase caps.

### Talents & their requirements ⬜ not built *(requirement types locked by the owner, R13)*
Discrete, mostly one-line perks (some ranked), bought with XP, cheaper if they fit a role. Each
must be legible from one tooltip line — no "+2% in a sub-case" noise. Sample direction (all 🟡
illustrative, not authored content): **Hardy** (+Constitution Bonus to Health — R12),
**Marksman** (+Ranged / steadier aim), **Combat Reflexes** (+Initiative), **Resolute** (+resist
Fear/Intimidate, slower Stress gain), **Dual Wielder**, **Field Dressing** (stabilize a Downed
ally), **Trapper**, **Fleet Footed**, **Lettered/Linguist**, **Stout Heart** (insanity buffer).

**Requirements to take a talent** — the owner's full list (a talent may require **any/all** of):
| requirement | example |
|---|---|
| **skill node ≥ N** | *Master's Eye* needs Smithing ≥40 AND any leaf ≥60 |
| **attribute ≥ N** | *Powerful Build* needs Strength ≥45 |
| **race** | *Amphibious Master* — lutren only |
| **deed-trait ≥ N** (flavor-progression.md) | *Merciless* needs Cruelty ≥5; *Paragon* needs Honor ≥8 — possibly several at once (Mercy 5 **and** Empathy 8) |
| **faction rep** (factions.md) | a faction-taught technique needs Honored standing |
| **in-game achievement / quest flag** | *Spire Champion* needs a won Duel; a style unlocked by a quest |

This makes the XP economy a rich **unlock web**, not flat stat buys — talents are how deed traits,
reputation, race and deeds finally *pay off mechanically* (the whole point of tracking them,
flavor-progression.md/factions.md). Requirements reuse the shared condition language
(`world/conditions.ts`) wherever possible. Not built.

### The intended breadth — ~30 top-level trees 🟡 *(was P14)*
Only four top-level trees are prototyped in code today (below). The design target is roughly
**30 top-level skills** (each potentially its own tree) — few enough to fit a Discord select,
with a Basic/Advanced split (Advanced skills need ≥1 point to attempt at all — you cannot read
without Literacy, or pick a lock without Pick Lock). The pre-tree design list, grouped by its
proposed root attribute, sketches the intended launch catalog:

| root attribute | skills |
|---|---|
| Strength | Athletics, Row |
| Constitution | Constitution (resistance) |
| Agility | **Melee**, Dodge, Climb, Stealth, Acrobatics, Ride, Swim |
| Dexterity | **Ranged**, Trade (a craft, per-material), Sleight of Hand, Pick Lock, Sail/Drive |
| Perception | Awareness, Track, Search, Navigate |
| Intelligence | Lore (per topic), Literacy, Heal, Herbalism, Engineering |
| Willpower | Cool (resist fear/Stress), Concentrate |
| Charisma | Charm, Persuade, Intimidate, Deceit, Haggle, Leadership, Gossip, Animal Handling |

**Simple layer:** race + role hands a starting set; a casual player never opens this list.
**Deep layer:** it's a shop steered by what a player chooses to do. Which of these become
real trees (vs. staying flat leaves under a thin root), the final count/grouping, and how
Smithing/Metallurgy/Speechcraft/Athletics/combat (the shipped prototypes) map onto or replace
entries here, is still open.

### The skill panel — viewing a character's trees ✅ built *(owner-requested; `/character skills`)*
The owner wanted a **panel to show a character's skill trees**, **under `/character`** ("skille
powinny być pod /character skills bo to część postaci"). **Built** (`commands/components/
_skillPanel.ts` + the `charskills` component handler): a stateless ephemeral panel (the `/profile`
pattern — personal, clicker = owner, no ids in the customIds, restart-proof), reached via
**`/character skills`**. Overview → every **tree root** with the character's trained points +
governing attribute blend + a select to open one; tree view → the whole tree as a monospace table
(each node's **points**, the **Effective** a check would roll, and **progress toward the next
point**) + a Back button and the same select to jump around. Reads purely from `progression` + the
static catalog. **Still ⬜** (deferred with their systems): nodes don't show faint/locked or
Advanced entry requirements yet (Advanced skills aren't modeled); the **attribute-raise unlock
buttons** (R13) and **talent-unlock hints** land here once those economies exist — the panel is
the seam they'll hang off.

### Magic stance ✅ (low fantasy, no exceptions)
**No player spellcasting** — canon backs this (rich religion and myth per race, but nobody
casts). Herbalism, Alchemy and Medicine are the mundane, skill-based way the setting handles
what a higher-fantasy game would spend on magic — ordinary skills on the Intelligence branch
above, feeding recovery/treatment (combat.md's Downed/recovery, flavor-progression.md's
Stress treatment). Any true mysticism (omens, relics, "old powers") is rare, dangerous, and
strictly an Imperator/quest-authored tool — never a player-facing mechanic.

### Worked example — Smithing (crafting reads the sum as quality)
The short version of the original design-docs walkthrough (illustrative, not a rule): a lutren smith with
Dexterity 44, Smithing 70, Weaponsmithing 55, Bladesmithing 40 has **Effective 187** forging a
sword (`AttrTerm 20 + 70 + 55 + 40`), but only **112** forging plate armour (his neglected
armour branch) — the shared parents carry over into every leaf, but the trained leaf still
decides the ceiling. An item's **Required Sum** (e.g. a masterwork blueprint needing 250) then
becomes a wall a generalist literally cannot clear — since each node caps around 100, reaching
250 demands pushing one leaf deep into Mastery *and* raising the attribute. Surplus over the
required sum becomes **quality tiers** (0–24 Crude · 25–49 Standard · 50–99 Fine · 100+
Superior/Masterwork). A proposed **"edge-of-ability" stretch rule** lets a crafter risk an
attempt even short of the required sum: within ~20 below it, roll
`d100 ≤ 95 − (Required − Effective)×3`; failure wastes the materials + AP. **⬜ Not built**:
item required-sums, quality-from-surplus, and the stretch-roll don't exist in code yet —
items.ts's `quality` field today is a flat per-instance tag set at acquisition
(items-equipment.md), not derived from a check.

---

## Implementation

### The engine — `game/data/skills.ts` (catalog) + `game/character/skills.ts` (pure logic) ✅ model / 🟡 content
The tree is **static content in code** (`SKILL_NODES: Record<SkillNodeId, SkillNode>`); a
`SkillNode` is `{ name, parent: id|null, attributes?: AttributeWeights, growth?:
GrowthProfileId, cap?, description? }`. A character stores only a **sparse map** — only nodes
they've touched — under `Character.progression.skills: Partial<Record<SkillNodeId,
{points, progress}>>` (an absent key reads as 0). This is deliberately the flat-in-DB,
tree-in-code split: adding a branch or a whole new tree is one catalog edit with **zero
migration**.

Core functions (`game/character/skills.ts`, pure, tested):
- `pathToRoot(id)` / `pathNodeSet(ids)` — walk to root; dedupe when a spec draws on several
  nodes (a shared parent between two siblings is only summed once).
- `resolveBlend(id)` — a node's own `attributes`, or the nearest ancestor's (inheritance).
- `attributeTerm(attrs, id)` — Σ weight·attribute over the resolved blend.
- `skillSum(progression, ids)` — Σ points over the unique path nodes.
- `effectiveSkill(attrs, progression, {node, extraNodes?})` — the full uncapped Effective;
  `checks.ts` (combat.md) clamps it into a d100 %.
- `creditUse(progression, ids)` — learn-by-doing: +1 use to every node on the combined path,
  each converting banked `progress` → `points` at its own `usesForNextPoint` rate; returns the
  updated sparse map + which nodes ranked up. Capped nodes stop banking progress they can never
  spend. **No live caller credits this yet** — `characterService.creditSkillUse` is a ready
  seam, waiting on a first consumer (crafting or combat).

Growth profiles (`GROWTH_PROFILES`, 🟡 numbers, owner's worked example): named `root` / `branch`
/ `leaf` band tables of uses-per-point, steepening as points climb (root 10→50→200 uses/pt;
branch 10→30→100; leaf 5→20→60). A node's profile is explicit or defaulted by its depth
(root=0, branch=1, leaf=2+). `SKILL_NODE_CAP = 100` — Mastery above that via special sources is
future, per the Ruleset section above.

### The prototype trees shipped today 🟡 content
- **Smithing** (root, blend `0.2 INT + 0.1 DEX`) → Weaponsmithing → {Bladesmithing,
  Axesmithing, Haftsmithing (leaf override: `0.2 STR + 0.1 DEX`)}; and Armoursmithing → {Light,
  Heavy Armoursmithing}.
- **Metallurgy** (root, blend `0.2 INT`) → {Iron & Steel, Bronze} — the cross-tree material
  path a smithing recipe also sums via `extraNodes`.
- **Speechcraft** (root, blend `0.5 CHA`, `growth: branch`) → {Persuade (pure CHA, inherited),
  Intimidate (override `0.25 STR + 0.25 CHA`), Deceit (override `0.25 CHA + 0.25 INT`)} — the
  cross-attribute-blend demo.
- **Athletics** (root, blend `1.0 AGI`) → {Swimming (blend `1.0 AGI`, explicit), Climbing
  (inherited)} — keeps the travel-challenge swim check working (world-travel.md).
- **Combat placeholders** (no live consumer — sparring still uses the old flat combat formula,
  combat.md): Melee (`0.5 AGI`) → One-Handed → {Blades, Axes & Maces}; Melee → Two-Handed →
  {Great Blades, Polearms}; Ranged (`0.5 DEX`); Brawling (`0.5 AGI`) → Striking.

### Storage — `progression` subdoc ✅ D32
`Character.progression: { skills: SkillProgression }`, stored as a plain (Mixed) object so
talents/points can join the subdoc later with **no schema change**. Bounded + hot-path
(read on every check) ⇒ embedded, per root `CLAUDE.md`'s D32 persistence rule — the opposite
case (unbounded state) is why owned-but-uncarried items got their own collection
(items-equipment.md's stash, D33).

### What's wired, what isn't
- ✅ `game/checks.ts` (combat.md) consumes `effectiveSkill`/`checkTarget` for travel challenges.
- ✅ `characterService.creditSkillUse` exists as a seam.
- ⬜ No live action calls `creditUse` yet — skills currently never grow in play.
- ⬜ Roles, the XP/points economy, and talents are pure design (above) — nothing in `game/` or
  `db/` yet.
- ⬜ **XP + skill-gated attribute raises (R13)** — no `xp` field, no per-attribute unlock
  tracking, no `raiseAttribute` seam.
- ⬜ **Talent requirements** — the requirement-type gating (skill/attribute/race/trait/rep/
  achievement) has no data model; reuses `world/conditions.ts` when built.
- ✅ **The skill panel** — `/character skills` (`_skillPanel.ts` + `charskills` handler), read-only.
- ⬜ Practice-source quality-gated caps (home/workshop/commission) — only the flat diminishing-
  returns bands exist.
- 🟡 **First `creditUse` consumer** is likely **foraging** (professions.md) — the peaceful
  professions are the natural place skills first grow in play.

---

## Open questions

- **Roles** *(P12)* — launch list + special actions; growth-modifier size; one axis or two
  (civic vs adventuring).
- **XP / points economy** *(P13 → R13, direction set)* — the *model* is decided (XP buys talents;
  attribute raises are **skill-use-gated**, only unlockable attributes, then XP-bought & steep).
  Open *numbers*: XP yields from quests/milestones/skill-ups; the per-attribute unlock threshold;
  the attribute-raise cost curve; talent prices.
- **Talent requirements** *(R13)* — data-modeling the requirement types (skill/attribute/race/
  deed-trait/faction-rep/achievement) on the talent catalog; how they render in the skill panel.
- **The skill panel** *(owner)* — ✅ built as `/character skills` (the owner's placement). Still
  open: how much to show a casual (only touched trees + "recommended" hints?) vs the full deep
  view; adding the R13 attribute-raise buttons + talent-unlock hints once those economies exist.
- **Skill & talent catalog breadth** *(P14)* — target ~30 top-level trees (fits a Discord
  select); which ones beyond the four prototypes; the launch talent list beyond the ten
  sketched above.
- **First `creditUse` consumer** — **foraging/professions** (professions.md) is the likely first,
  ahead of combat; whichever ships first is what finally makes skills grow in play.
- **Item required-sum gates + quality-from-surplus** — the crafting-quality half of the
  Smithing example isn't implemented; today's per-instance item quality (items-equipment.md)
  is set at acquisition, not derived from a check.
- Attribute weight `w` per tree, and per-node growth/cap tuning generally — all 🟡, meant to be
  revisited once there's real play data.

---

## Expansion ideas & risks

**Risks:**
- **The XP-gated attribute raise (R13) can build a wall, not just friction.** If a character has
  only ever trained, say, Speechcraft, they can never unlock Strength — full stop, no matter how
  much XP they bank — because the gate is "have you trained a feeding skill," and they haven't.
  This is fine as an incentive to specialize, but if a player *wants* to pivot their character's
  concept later (a talker who decides to become a fighter), there's currently no path back short
  of grinding Strength-rooted skills from a raw-attribute disadvantage. Needs at least one release
  valve — see character.md's matching risk entry for a proposed "training montage" one-off.
- **~30 top-level trees is a lot of Discord-select real estate.** Even at "fits a select," a
  player choosing among 30 sibling trees with only a handful trained needs strong sorting/
  filtering (role-recommended first, touched-trees pinned) or the skill panel becomes a wall of
  text instead of the "casual glance, deep drill-down" it's meant to be.
- **`creditUse`'s "meaningful use" rule is a judgment call per consumer.** Every future system
  that credits skill use (professions, crafting, combat) has to independently decide what counts
  as "had a real cost or a chance of failure" — inconsistent judgment across consumers could make
  growth feel arbitrary in one system and generous in another. Worth a one-line house rule stated
  once here rather than re-litigated per file: *if a check was rolled and could have failed, it
  counts; free/auto actions never do.*

**Expansion ideas:**
- **The skill panel could double as a "next step" recommender** — beyond showing points/progress,
  a small "you're 12 uses from your next Bladesmithing point" or "training Athletics would unlock
  +Agility" hint turns the panel from a status screen into active guidance, which matters a lot
  for a casual player who doesn't know the tree exists otherwise.
- **Skill decay for truly abandoned trees** — not currently proposed anywhere, and probably not
  worth it (adds anxiety, contradicts the "no forced login" AP philosophy), but worth explicitly
  rejecting on the record: skills should **not** decay from disuse, only grow. Consistent with
  world-travel.md's uncapped-AP "come back whenever" design.
- **Cross-tree "prestige" nodes** — once several trees are real, a rare top-level node requiring
  Mastery in two *unrelated* trees (e.g. Smithing **and** Speechcraft, for a master weaponsmith
  who's also a legendary haggler) could reward genuinely unusual builds without a new mechanic —
  just an `extraNodes`-style cross-reference on a single special leaf.
