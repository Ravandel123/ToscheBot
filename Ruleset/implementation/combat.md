# Combat — implementation

What exists in `src/` today for the rules in [combat.md](../combat.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

### The check engine — `game/checks.ts` ✅ shape / 🟡 numbers
`CheckDefinition = { node?, extraNodes?, attribute?, attributeWeight?, modifier?,
raceAffinity? }` — a check draws on a **skill node** (skills.md's summed-tree model) or a bare
**attribute** (untrained feats, e.g. climbing a fallen tree; `attributeWeight` defaults to the
whole attribute). `checkEffective` returns the raw uncapped Effective; `checkTarget` shapes it
by the difficulty `modifier` and a per-check `raceAffinity` multiplier (e.g. `{lutren: 1.5}` on
a swim check), then clamps to `[CHECK_MIN_TARGET=5, CHECK_MAX_TARGET=95]`. `rollAgainst(target)`
does the actual d100 roll and returns `{roll, target, success, successLevels}` — `successLevels
= floor(target/10) - floor(roll/10)`, matching the Ruleset formula above exactly.
`rollCheck(subject, check)` is the one-shot convenience. Consumers **store the computed target**
at the moment a check is offered (world-travel.md's travel challenges) so a repainted panel's
shown percentage and the actually-rolled percentage can never disagree.

Consumed by travel challenges, dialogue checks, gathering and (since D35) combat. Not yet by
crafting — none exists.

### SmackdownRecord — `db/models/smackdownRecord.ts` ✅
One doc per `Character._id`: `{characterName, duelWins, duelLosses, trialRung}`.
`characterName` is denormalized so `/leaderboard` needs no join. Per character, not per
account. Docs written before 2026-11-11 may still hold `eloRating`/`wins`/`losses` from the
removed slash sparring; nothing reads them.

### Saving a bout — `db/services/boutService.ts` ✅ *(D52)*
A duel or trial is resolved in memory, then **saved before it is narrated**: damage first,
then learning, then the reward and the record. The narration (30–45 s of delayed messages)
runs afterwards, still under the fighters' locks so a second fight cannot overlap it. A
restart mid-narration therefore loses only the telling, never the outcome. On a ladder climb
the coins are paid before the rung advances — an interruption between the two can never
leave a cleared rung without its reward.

### Duel — `/smackdown duel` + the real engine ✅ v1 / 🟡 numbers *(D35)*
The serious tier (owner-requested, superseding the D14 "no combat mechanics" stance for the *v1
model*, as D25/D34 did for attributes/skills). Three pieces:
- **`game/combat/duel.ts`** — the pure resolver. Each exchange is an **opposed d100** (both roll
  their own `checks.ts` test; the higher Success Level connects, skill-tiebreak else defender);
  damage = `weapon + net SL + StrengthBonus − Soak`, floored to the **≥1 connecting-hit** rule;
  auto-resolved in one pass whose turn order is **momentum-driven** (D42, `followUpChance`): a
  landed blow may keep the initiative and press again, a miss passes it — the sparring narration
  shape on real math, no longer strict alternation. Styles + the combat plan are LIVE (D41):
  each exchange re-evaluates both plans and applies the active style's targets/modifiers/effects
  (hamper, riposte). Fields for the deferred layers (`damageType`) are carried but **inert**, and
  `computeDamage` has commented insertion points for the armour✕type multiplier and the
  crit/hit-location step — so each layer is a fill-in, not a reshape (owner: "start WITHOUT
  styles/named-moves/location-crits, but take them into account").
- **`game/combat/profile.ts`** — derives a `CombatProfile` from the REAL systems: equipment-
  modified attributes (D28), the melee/brawling skill-tree Effective (D34 — the attack draws on
  the wielded weapon's grip branch, or the **Striking** leaf unarmed; the chosen node rides the
  profile as `attackNode`), worn **AV** into
  `Soak = ConstitutionBonus + AV`, and the character's **actual `resources.health`** as the pool
  (no frame/Constitution max recompute yet — the R12 pool-with-locations is the next layer; v1
  uses the stored pool, which reads fine for the unarmed Spire). `isDowned` = Health ≤ 0.
- **`commands/components/duel.ts` + `_duelView.ts`** — the **consent-gated** flow (combat.md's
  locked async-fairness rule): `/smackdown duel` posts a card with the fight uncommitted; only the
  **challenged** player's Accept starts it, so nobody loses Health offline (approved characters
  only, D16). The bout runs under both characters' lock, narrates each blow, then **persists real
  damage to BOTH** via atomic clamped `applyResourceDeltas` deltas (it does not mend at once —
  slow hourly regen is the only recovery). **0 Health = Downed** → `canCharacterAct` already
  reports `incapacitated`, so no new field; **no other cost** (no AP loss, no permadeath — a KO is
  "wake with a dented pride"). It's a **short action** (D5 rule 1: resolve in memory, commit once),
  not an ActivitySession — **manual turn-by-turn** (R24 option 2) is the documented next layer over
  the same profile/engine; wagers, a duel W/L record, and Trial/PvE are the other seams.
  **Learn-by-doing (D40, extended by D41):** after the damage is persisted, BOTH fighters are
  credited via `creditSkillUse` on the paths they **actually fought in**
  (`trainingNodes` — each used style's branch, the plain attack node for style-less stretches,
  and always the weapon branch when armed), weighted by the opponent's relative strength
  (`game/combat/training.ts`; skills.md Reference has the formula) — win or lose, and a foe at
  ≤ half your power credits nothing. The trial does the same for the player only (a rematch vs
  an outgrown champion naturally decays to zero). Sparring credits nothing (fantasy stakes).
  Rank-ups announce in the Spire narration (`📈 … rises to N`).
- **Numbers stay 🟡**: attack/defence bases, unarmed damage, the pool size (still the flat 20 from
  `resources.ts`, not the R12 frame+Constitution pool).

### Challenge spam guard — `game/combat/pendingChallenges.ts` ✅ / 🟡 numbers *(D59)*
A duel card pings its target in the Spire channel, so `/smackdown duel` has two limits,
checked after every other validation: a challenger waits 30 s between challenges (the owner
is exempt, as with every cooldown), and a character with an unanswered challenge cannot be
challenged again until they accept or decline it — or until the card is 10 minutes old. The
pending set is in memory; a restart forgets it, which only re-allows a challenge.

### Fighting styles & the combat plan ✅ v1 / 🟡 numbers *(D41)*
Four pieces, all pure below the panel:
- **`game/combat/styles.ts`** — the style catalog (D10): family, the skill node it draws on,
  optional `modifiers` {attack, defense, damage}, optional `effects[]` (typed union — `hamper`,
  `riposte`; adding a kind = one union member + one engine step). Catalog-validated by
  `styles.test.ts` (a style's node must sit under its family's tree root; select budgets).
- **`game/combat/plan.ts`** — plan types + evaluation: `FamilyPlan {style, rules[≤3]}`,
  triggers `self-health-below` / `foe-health-below` / `round-at-least`, `activePlanStyle`
  (first-match priority), `sanitizeFamilyPlan` (defensive read — unknown/wrong-family styles
  drop, values clamp; D10 rule 3). Stored sparse on `Character.combatPlan` (Mixed, per-family
  `$set` via `characterService.setCombatPlan`).
- **Engine + profile** — `combatProfile` resolves the fighter's **family** from the main hand,
  reads that family's plan, and precomputes **per-style base targets** from each referenced
  style's node path (stored up front — the honest-odds discipline; unarmed: the node replaces
  the attack draw, armed: weapon branch + style branch summed, defence = the style node's path
  both ways). `resolveDuel` re-evaluates both plans at the top of every exchange, applies the
  active style's modifiers (clamped [5,95]), runs hamper (fouls the foe's next swing) and
  riposte (a ≥2-SL defence counters through Soak, ≥1), and reports `openingStyles`,
  per-blow `styleSwitches` and `stylesUsed` for narration + training. Champions carry a
  hand-authored `plan` (their stat block IS their style's base — only modifiers/effects apply);
  several ladder rungs use one (Osk grapples, Dourmane stonewalls, Busk turns Striker once
  you're under half — the ladder teaches the system by showing it).
- **`/character combat`** (`combatplan` handler + `_combatPlanView.ts`) — two panels over the
  same stored plan (D59; a tester found the full editor overwhelming):
  - the **simple panel** (what the command and the hub shortcut open): one question, "how do
    you fight?", one style select for the family of the weapon in hand
    (`wieldedFamily(character)`), and a "Tactics…" button;
  - the **tactics panel**: a default-style select per family (each option shows the trained
    path points), a two-step rule builder (discrete trigger menu → style; the half-built rule
    rides the customId), clear-rules per family, and "Simple view".
  Both are ephemeral/personal/stateless (the `/profile` pattern). A plan edit is one atomic
  per-family `$set` — no lock needed (a fight snapshots the plan under ITS lock).
- **Training (D40 extension)** — `trainingNodes(profile, stylesUsed)`: each style actually
  fought in trains its branch (a whole bout in Grappler banks nothing into Striking), a plain
  stretch trains the base attack node, an armed fighter always keeps training the weapon branch.
🟡 all numbers (modifier sizes, hamper −15, riposte margins/damage, champion plans).

### Bout modes — the ruleset layer ✅ v1 / seams *(D36)*
`game/combat/bouts.ts` is the data-driven **bout catalog** (D10) — the customization surface the
Spire grows into, since it's meant to be a big feature. A `BoutMode` is everything that shapes a
fight *before* the engine rolls. `/smackdown duel [mode]` shows the modes as choices; the pick
rides in the challenge card (so the target consents to *those* rules) and the accept customId.
- **Consumed today — `loadout`:** **Full Gear** (`geared`, default — fight as equipped, D28) and
  **Bare-Knuckle** (`bare` — gear is set aside at the door: bare attributes, fists, no AV, no
  equip penalties; the pack itself is untouched). `combatProfile(character, { loadout })` applies it.
- **Designed SEAMs (typed + authored, mechanics deferred):** `arena` (terrain tags + obstacles —
  R25, the owner's "sandy arena with obstacles"), `allowedWeaponKinds` (a weapons-only / future
  "axes only" bout), `opponent` (`'player'` = consent PvP today, `'npc'` = a PvE Trial), and
  `stakes` (`'real'` duel vs `'fantasy'` — lets sparring fold in later). A future mode
  **`sand_axes`** ("Sands of the Axe": axes-only on shifting sand with cover) already exists in the
  catalog as `selectable: false` — proof the shape holds end-to-end; flip the flag once the R25
  arena + weapon-filter mechanics are built, no other wiring changes.
- **Leaderboard categories** (`game/combat/leaderboards.ts`) — `/leaderboard [category]` ranks the
  one record set by a catalog-chosen field (**Duelists** = duel wins, **Spire Ladder** = rung);
  adding a board is a catalog entry (+ a record field if it needs new data). **SEAM:** a *per-mode*
  ladder (a separate Bare-Knuckle or PvE-Trial board) adds a `mode` dimension to `SmackdownRecord`
  and a filter here; the picker shape already fits it.
### PvE — the Spire ladder ✅ v1 / 🟡 content *(D37)*
`/smackdown trial` (owner's #PvE: "10 fighters, each stronger, you beat them, then a reward").
`game/combat/spireLadder.ts` is a fixed gauntlet of **Spire-only champions** — hand-authored
`CombatProfile` stat blocks (D10), **not world/town NPCs and not DB characters** (the owner ruled
town-NPC dueling out): the engine already takes two profiles, so a champion is a stat block with
no owner and **no consent** needed. A character's cleared rung lives on `SmackdownRecord.trialRung`
(`$max`, monotonic); a win against your **next unbeaten** champion advances the
rung once and pays its **one-time reward** (Deltrada Coins today; a title/item/reputation is the
SEAM), a loss costs **real Health** (persisted like a duel, D35 — you can be Downed, then must heal
before trying again). **Rematches** let you
re-fight any champion you've cleared — still real Health at stake, but **no reward and no rung
change**, so the climb's rewards can't be farmed (reward fires only on beating your *next* unbeaten
rung; a champion above your progress is refused). Fought **as-equipped**; the champion is always at
full Health, the player at their current pool. Ranked on
its own **`🏟️ Spire Ladder`** leaderboard category.

**The UI is a browsable roster panel, not a name argument** (owner's TODO): `/smackdown trial`
(no options) opens an ephemeral, **stateless** panel (`_trialView.buildTrialBrowser` + the `trial`
component handler) — scroll the champions ◀ ▶ one at a time, each showing its blurb, fighting stats,
reward and a 🖼️ **portrait placeholder** (images.md — art is optional), with a **Fight** button live
only for a climb or an earned rematch and **🔒 disabled** on a champion above your progress. Clicking
Fight runs the bout in the Spire channel (same lock/persist choreography as `duel.ts`). This replaced
the old `opponent:<name>` string option: a bare `/smackdown trial` now always opens a real menu
instead of guessing, and no typo'd/invalid champion name can reach the engine (the crash it fixed). 🟡 The roster + every stat/reward is a
placeholder. SEAMs: a per-rung bout mode (bare-knuckle trials), boss loot, and — if ever wanted —
the separate world/town-NPC duel (`opponent: 'npc'`, consent rolled) the owner flagged as "maybe
later, not now".

### What's missing entirely
- The **hit-location trauma tally** + **concentrated-damage critical injury** (R12) and the
  frame+Constitution **Health max** (the pool is the flat stored `health` for now, not split per
  location) — design only; the duel above uses one shared pool with no locations.
- The **armour ✕ weapon-type** multiplier — design only (the `computeDamage` seam is marked).
- **Combat styles ✅ BUILT (D41)** — what still waits: the `knowsStyle` **counter-play** defence
  bonus (now cheap: key it on the defender's path sum for the attacker's active style's node),
  **ranged shooting styles** (typed family, no engine), **named canon schools** as learned
  talents, and **named signature moves** — the last two are design only.
- **Fate points** — no field, no spend path.
- `/smackdown duel` **built (D35)** and `/smackdown trial` (PvE Spire ladder) **built (D37)**; still
  missing: **wagers**, a duel W/L record, boss loot / titles as trial rewards, and the **manual
  turn-by-turn** mode (R24 option 2 — the auto-resolve v1 is a short in-memory action, not yet an
  `ActivitySession`).
- Criticals/fumbles (now decided, R21), **Initiative is used** (first strike; D35), Fatigue,
  Conditions (Bleeding/Prone/Stunned/Shaken/Broken) — the rest none built.
- **~~The R24 pre-fight setup menu~~ → superseded by the combat plan (D41):** `/character
  combat` sets standing orders once, ahead of every fight — strictly better than a per-fight
  menu in an async game (the challenged player's plan fights for them while they're offline).
- **Positioning & terrain (R25)** — explicitly not started, future-only; no grid, no terrain tags.
