# Skills — the skill-tree model, growth, Roles, points & talents

See [README.md](README.md) for the legend. This is the R10/R11/D34 skill-tree model — the
project's biggest single mechanic and the reference for how "sum along a tree" reads for both
crafting and combat.

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

### Points — the deliberate min-max layer ⬜ not built *(was P13)*
Earned from skill-ups, quests and milestones — **not from each individual use**, which would
just reward farming trivial actions. Spent on:
- **Talents** (below) — the main sink.
- **Attribute bumps** — attributes don't rise by use (character.md); this would be their only
  growth path. ⚠️ **Must be priced steeply** (or milestone-gated) — an attribute feeds every
  tree rooted on it *and* derived combat stats, so if it's cheap it becomes the only rational
  spend and every build converges (character.md's "attribute double-dip" warning).

Casual: a **"Recommended"** button one-click-spends points on role-appropriate talents — never
touch a number. Deep: hand-pick talents, plan attribute bumps, chase caps.

### Talents ⬜ not built
Discrete, mostly one-line perks (some ranked), bought with points, cheaper if they fit a
role. Each must be legible from one tooltip line — no "+2% in a sub-case" noise. Sample
direction (all 🟡 illustrative, not authored content): **Hardy** (+Endurance Bonus to Wounds),
**Marksman** (+Ranged / steadier aim), **Combat Reflexes** (+Initiative), **Resolute** (+resist
Fear/Intimidate, slower Stress gain), **Dual Wielder**, **Field Dressing** (stabilize a Downed
ally), **Trapper**, **Fleet Footed**, **Lettered/Linguist**, **Stout Heart** (Madness buffer).
Talents may also **gate on node thresholds** (e.g. *Master's Eye* — requires Smithing ≥40 AND
any leaf ≥60 — +1 quality tier chance, −1 AP to forge on that leaf) — this makes the points
economy a richer "unlock" layer, not just flat stat buys. Not built.

### The intended breadth — ~30 top-level trees 🟡 *(was P14)*
Only four top-level trees are prototyped in code today (below). The design target is roughly
**30 top-level skills** (each potentially its own tree) — few enough to fit a Discord select,
with a Basic/Advanced split (Advanced skills need ≥1 point to attempt at all — you cannot read
without Literacy, or pick a lock without Pick Lock). The pre-tree design list, grouped by its
proposed root attribute, sketches the intended launch catalog:

| root attribute | skills |
|---|---|
| Strength | Athletics, Row |
| Endurance | Endurance (resistance) |
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

### Magic stance ✅ (low fantasy, no exceptions)
**No player spellcasting** — canon backs this (rich religion and myth per race, but nobody
casts). Herbalism, Alchemy and Medicine are the mundane, skill-based way the setting handles
what a higher-fantasy game would spend on magic — ordinary skills on the Intelligence branch
above, feeding recovery/treatment (combat.md's Downed/recovery, flavor-progression.md's
Stress treatment). Any true mysticism (omens, relics, "old powers") is rare, dangerous, and
strictly an Imperator/quest-authored tool — never a player-facing mechanic.

### Worked example — Smithing (crafting reads the sum as quality)
See the full walkthrough in the old `RPG/Examples.md` (kept for reference, not migrated
verbatim here since it's illustrative, not a rule). Short version: a lutren smith with
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
- ⬜ Roles, the points economy, and talents are pure design (above) — nothing in `game/` or
  `db/` yet.
- ⬜ Practice-source quality-gated caps (home/workshop/commission) — only the flat diminishing-
  returns bands exist.

---

## Open questions

- **Roles** *(P12)* — launch list + special actions; growth-modifier size; one axis or two
  (civic vs adventuring).
- **Points economy** *(P13)* — the use→progress math tuning beyond the shipped bands; point
  yields from quests/milestones; talent prices; how steeply attribute bumps must be priced.
- **Skill & talent catalog breadth** *(P14)* — target ~30 top-level trees (fits a Discord
  select); which ones beyond the four prototypes; the launch talent list beyond the ten
  sketched above.
- **First `creditUse` consumer** — crafting or combat, whichever ships first, is what makes
  skills actually grow; currently nothing calls it.
- **Item required-sum gates + quality-from-surplus** — the crafting-quality half of the
  Smithing example isn't implemented; today's per-instance item quality (items-equipment.md)
  is set at acquisition, not derived from a check.
- Attribute weight `w` per tree, and per-node growth/cap tuning generally — all 🟡, meant to be
  revisited once there's real play data.
