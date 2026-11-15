# Skills — implementation

What exists in `src/` today for the rules in [skills.md](../skills.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

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
- `creditUse(progression, ids, uses = 1)` — learn-by-doing: `uses` (the training weight —
  fractional, ≤0 is a no-op, progress stored to 2 decimals) added to every node on the combined
  path, each converting banked `progress` → `points` at its own `usesForNextPoint` rate;
  returns the updated sparse map + which nodes ranked up. Capped nodes stop banking progress
  they can never spend. **Live since D40** via `characterService.creditSkillUse(id, nodes,
  uses)`: the Spire duel + trial (weight from `game/combat/training.ts` — `combatPower` ratio,
  crediting the profile's `attackNode` path) and travel-challenge checked options (weight from
  `checkTrainingWeight`).

Growth profiles (`GROWTH_PROFILES`, 🟡 numbers, the owner's 10→100 pacing example): named
`root` / `branch` / `leaf` band tables of uses-per-point, steepening as points climb — the
exact table is in the Reference above (knees at 5/10/20/40 points). A node's profile is
explicit or defaulted by its depth (root=0, branch=1, leaf=2+). `SKILL_NODE_CAP = 100` —
Mastery above that via special sources is future, per the Ruleset section above.

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
  (inherited)} — keeps the travel-challenge swim check working (world-travel.md); the
  fallen-tree climb option draws on (and since D40 trains) Climbing.
- **Awareness** (root, blend `1.0 PER`) → {Searching} — added with D40 so the travel
  challenges' spot/search options train something real; the design list's Perception root,
  deliberately minimal (Track/Navigate join it when built).
- **Foraging** (root, blend `0.3 INT + 0.3 PER`) → {Identify} — S1's profession tree
  (professions.md R16): the gather check rolls (and trains) the root, the identify sweep and
  the Examine action the leaf. The R16 table's per-family leaves (Mushrooms, Herbs, Fruit &
  Forage) join as content when per-family gathering matters — a catalog edit, zero migration.
- **Combat trees** (live in the serious engine since D35/D40/D41 — the duel/trial attack draws
  on and TRAINS the wielded weapon's branch, or the unarmed style's branch; sparring still uses
  the old flat throwaway formula, combat.md): Melee (`0.5 AGI`) → One-Handed → {Blades, Axes &
  Maces}; Melee → Two-Handed → {Great Blades, Polearms}; Melee → **style branches** {Onslaught,
  Binding, Warding} (D41 — an armed style sums its branch WITH the weapon branch via
  `extraNodes`, and its path is the style's defence); Ranged (`0.5 DEX`); Brawling (`0.5 AGI`)
  → {Striking, **Grappling**, **Guard**} (the brawling branches ARE the unarmed styles' nodes —
  unarmed, the technique is the approach). Weapon→leaf mapping (a longsword to Blades) is a
  SEAM — grip decides the branch until weapons carry a skill tag.

### Storage — `progression` subdoc ✅ D32
`Character.progression: { skills: SkillProgression }`, stored as a plain (Mixed) object so
talents/points can join the subdoc later with **no schema change**. Bounded + hot-path
(read on every check) ⇒ embedded, per `DECISIONS.md` D32 persistence rule — the opposite
case (unbounded state) is why owned-but-uncarried items got their own collection
(items-equipment.md's stash, D33).

### What's wired, what isn't
- ✅ `game/checks.ts` (combat.md) consumes `effectiveSkill`/`checkTarget` for travel challenges.
- ✅ **Skills grow in play (D40)**: `/smackdown duel` credits BOTH fighters' fought paths
  (opponent-strength weight, `game/combat/training.ts`; since D41 `trainingNodes` credits each
  used fighting style's branch + the weapon branch when armed), `/smackdown trial` credits the
  player (champion-strength weight — an outgrown rematch credits 0), and travel-challenge
  checked options credit their node (difficulty weight, `checkTrainingWeight`). Rank-ups
  announce in the narration; the skill panel shows fractional banked progress.
- ✅ **Foraging credits (S1)** — the gather check trains the Foraging path (difficulty
  weight, win or lose); the one-roll identify sweep and the Examine action train Identify.
  An Examine of an already-known find rolls nothing and credits nothing (the house rule).
  Crafting crediting still ⬜.
- ⬜ Roles, the XP/points economy, and talents are pure design (above) — nothing in `game/` or
  `db/` yet.
- ⬜ **XP + skill-gated attribute raises (R13)** — no `xp` field, no per-attribute unlock
  tracking, no `raiseAttribute` seam.
- ⬜ **Talent requirements** — the requirement-type gating (skill/attribute/race/trait/rep/
  achievement) has no data model; reuses `world/conditions.ts` when built.
- ✅ **The skill panel** — `/character skills` (`_skillPanel.ts` + `charskills` handler), read-only.
- ⬜ Practice-source quality-gated caps (home/workshop/commission) — only the flat diminishing-
  returns bands exist.
- ✅ **First `creditUse` consumers landed (D40)** — Spire combat + travel challenges; foraging/
  professions (professions.md) join with the same call when built.
