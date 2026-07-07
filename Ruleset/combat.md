# Combat — the core test, Health, Smackdown

See [README.md](README.md) for the legend. The **d100 test** described here is not
combat-only — it's the one mechanic every risky action in the game uses (skills.md's skill
checks, world-travel.md's travel challenges, and combat below all roll the same way).

> **R12 supersedes the old "Wounds" design.** The owner dropped the low WHFRP-style Wounds pool
> (7–13, confusing — "why did 3 damage nearly kill me?") for a **larger, intuitive Health-points
> pool with hit locations**. The WHFRP *feel* stays (Soak, opposed rolls, crits, fumbles, gritty
> and fast); the *number* is legible and the *hit-location* system is the owner's addition. None
> of the old Wounds design was built, so this costs no migration.

---

## Reference (decided data & math)

**Core test** — roll **d100 ≤ Effective** (skills.md). `01` always hits, `00` always misses.
`SL = floor(target/10) − floor(roll/10)`. Target clamps to `[5, 95]`.

**Difficulty ladder** (one band, never stack): Very Easy +40 · Easy +20 · Standard 0 ·
Hard −10 · Very Hard −20 · Punishing −30. (🟡 values)

**Opposed test** — both roll; **highest SL wins**, margin = winner SL − loser SL; ties → higher
raw skill.

**Criticals & fumbles** ✅ R21 — a **double** (11,22,…,99) is a **critical** on a success / a
**fumble** on a failure. Crit → bonus effect (extra damage/quality, a location injury); fumble →
mishap (drop, self-hit, opening). Tosche narrates them **tame / dark-humor**, never gore.

**Health** ✅ direction R12 — **one shared Health pool** (intuitive size, 🟡 e.g. 40–100 from
frame + Constitution), never split per location. Every hit lands on a rolled/aimed **location**
(picks the Soak-relevant AV) and adds to that location's **trauma tally**; when a location's
tally crosses its threshold (limbs ~50%, head/torso ~30%, 🟡) → a **critical injury** there
(the owner's example: 50 max Health, 25 concentrated in the right hand ⇒ maimed hand), even
though it's the one shared total — not a per-location pool — that actually ran down. `0` total
Health = **Downed, never dead** (R8).

**Soak** = `ConstitutionBonus + Armour Value (AV)`. **Always "AV", never "AP"** (AP = Action
Points). A connecting hit (margin > 0) always deals **≥1 damage**.

**Damage** (melee) = `weapon Damage + net SL + StrengthBonus − Soak` (ranged: + a ranged term,
not StrengthBonus). `attributeBonus(v) = floor(v/10)`.

**Armour ✕ weapon type** ✅ direction — damage type (slash/pierce/impact) vs armour type
(cloth/leather/mail/plate) has a **multiplier** (slash ≈ useless vs plate; impact/pierce better).

**Fighting styles & the combat plan** ✅ v1 BUILT (D41, owner-designed) — styles are
**family-specific** (unarmed ≠ melee ≠ ranged — muay thai doesn't help a swordsman; the
family resolves from what's wielded). Catalog `game/combat/styles.ts`, 3 per family
(🥊 Striker / 🤼 Grappler / 🧱 Stonewall unarmed; ⚔️ Onslaught / ⛓️ Binder / 🛡️ Warden armed;
ranged = typed seam, no engine), each an optional mix of flat **modifiers**
(attack/defence/damage — Striker +10/−10/+2) and **effects** (**hamper**: a connecting hit
fouls the foe's next swing −15; **riposte**: a defence won by ≥2 SL counters for 1–3+StrB−Soak,
≥1). A style is a switchable DECISION, not a skill — but it **draws on a node**
(unarmed = its brawling branch; armed = a style branch under `melee`, summed with the weapon
branch via `extraNodes`): the path feeds the style's attack AND defence (owner's rule — knowing
your style well means striking *and* defending better in it) and fighting in it **trains that
branch** (D40). No unlock gate — an untrained style rolls its untrained path. The **combat
plan** (`/character combat` → `Character.combatPlan`) is the async agency layer: per-family
default style + up to 3 conditional switch rules (own HP below X% · foe HP below X% · from
round N), first match wins, re-evaluated each exchange (triggers are monotonic → no flapping),
switches narrated. Supersedes the old **Stances** placeholder (the inert `stance` field is
gone — "defensive stance" is now the Stonewall/Warden style). 🟡 all numbers.

**Initiative** = `AgilityBonus + PerceptionBonus`.

**Resolution mode** ✅ direction R24 — **v1 = auto-resolve**: set your standing orders ahead of
time, one button, the engine rolls every round and narrates with a delay (no per-round input).
**Manual, turn-by-turn** control is an explicit **later** upgrade, built only once v1 proves
fun. **Built (D35 + D41):** the auto-resolve v1 engine + the consent-gated `/smackdown duel`
(`game/combat/duel.ts` + `profile.ts`); the pre-fight setup menu landed as the **combat plan
panel** (`/character combat`) — better than a per-fight menu for an async game (the defender's
plan fights for them while they're offline).

**Positioning & terrain** ⬜ future, not v1, R25 — a lightweight grid (adjacent/ranged/flanked)
+ terrain tags (`cramped, uneven, slick, open`) that weapons/styles check against (a cramped room
blocks two-handed swings; sand hinders a footwork-based style). Designed direction only.

**Fate points** ✅ direction R21 — pool (proposed **2**): reroll a test **or** shrug off a
knockout. Refresh slowly on rest (not "per session").

**Smackdown modes**: Sparring ✅ (for-fun) · Duel ✅ (real stakes, consent-gated, D35) · Trial/PvE ✅ (Spire ladder, D37).

---

## Ruleset

### The core test ✅ R1
Roll d100. **Succeed if the roll ≤ your Effective** (skills.md explains how Effective is
built from an attribute blend + skill-tree points). The roll is a flat percentile, so the bot
can honestly say "you have 78%," and 1-point granularity is exactly what a min-maxer wants.
`01` always succeeds, `00` (=100) always fails — nothing is ever truly impossible or automatic,
even for a grandmaster.

### Difficulty ladder ✅ shape / 🟡 values *(was P11)*
One fixed ladder, applied as a **single band** (never stack several small modifiers — that's
the "deep-sim trap" that makes a bot game unreadable):

| situation | modifier |
|---|---|
| Very Easy | +40 |
| Easy | +20 |
| Standard (default) | +0 |
| Hard | −10 |
| Very Hard | −20 |
| Punishing | −30 |

### Success Levels (SL) ✅
`SL = tens(target) − tens(roll)`. On a success, higher SL is a cleaner win; on a failure, the
(negative) SL says how badly it was missed. Example: target 55, roll 23 → SL **+3**. SL is the
engine's workhorse — it drives opposed tests and combat damage **without a second roll**, and
Mastery (skills.md) adds bonus SL on top of whatever the dice gave.

### Opposed tests ✅
Both sides roll their own test; **highest SL wins**, and the **margin** (winner SL − loser SL)
scales the effect. Ties break to the higher raw characteristic/skill. One structure covers
melee, grapples, chases, haggling, deceit-vs-insight — reuse the same code path everywhere
rather than inventing a bespoke resolution per activity.

### Criticals & fumbles ✅ direction R21 *(was P10 — owner now wants them, WHFRP4-style)*
Rolling a **double** (11, 22, … 99) is a **critical** on a success and a **fumble** on a failure
— the WHFRP4 rule the owner asked for, and it costs no extra roll (it reads off the same d100).
- **Critical (hit)** — bonus effect: extra damage, guaranteed application of the hit-location
  **critical injury** above, or a bump in crafting quality (skills.md) outside combat. The deep
  layer can roll on an **Injury/critical table** for a specific consequence (a gash, a cracked
  rib); the casual layer just gets the effect + a narrated line.
- **Fumble** — a mishap on top of the miss: drop/foul the weapon, hit yourself/an ally, lose
  footing (Prone), give the foe an opening (their next attack is Easy). Deep layer may roll a
  **Fumble table**; casual gets one bad-luck line.
- **Concentrated-damage crits stack with this** — a called shot piling damage into one location
  (R12) can *force* a critical injury there without needing a double; a double just makes it
  cleaner or worse.
- **Narration tone (locked): Tosche describes crits/fumbles tame or dark-humor, never graphic.**
  The owner's explicit ask: convey *exactly what happened* (a maimed hand is a maimed hand) but
  in Tosche's wry, un-gory voice — "well, he won't be counting on that paw for a while, no-no"
  rather than a splatter of viscera. Same for lethal-looking results (which are Downed, not dead,
  R8): the outcome is honest, the words are Tosche.
Balance (crit/fumble frequency ~1-in-10 per die, table contents) is 🟡 — but the rule is in.

### Health — an intuitive pool with hit locations ✅ direction R12 *(supersedes P8's Wounds)*
The owner's call (TODO: "drop wounds for less confusing health points"). The old plan was a low
WHFRP-style **Wounds** pool (7–13). Two problems: a 7–13 pool is *unintuitive* to a casual (small
numbers make every hit feel lethal in a confusing way), and it can't express the owner's
hit-location idea. So:

- **One Health pool, a legible size — not partitioned.** A character has **one** Health total
  (🟡 target ~40–100), derived from **frame (weight/height) + Constitution** (the dropped Size
  term, character.md R20, folds in here). Every hit, regardless of where it lands, subtracts from
  this **one** number, and `0` is the **only** thing that means Downed. "You have 63/80" reads
  instantly — no per-limb bars to parse.
  **Why not split the pool per location** (my earlier draft of this section did): giving each
  limb its own little HP pool that *also* has to hit zero raises real questions with no clean
  answer — does an arm hitting 0 cripple it, Down the whole character, or nothing? Now you need
  N pools to track and display instead of one, and two "am I dead" conditions to keep in sync.
  It's also **less** realistic, not more: a person doesn't have independent life totals per limb —
  a solid hit *anywhere* threatens the whole body through blood loss/shock, which a single shared
  pool models correctly. This is also how the tabletop systems this project already borrows from
  handle it (WHFRP4, Dark Heresy/Rogue Trader): **one** Wounds/Wound total; hit location is
  rolled only to pick *where* on the body a hit lands, for Soak (armour-by-location) and for
  flavoring a critical — never a second life bar.
- **Hit location is rolled (or aimed) per hit** and drives two things: which body-location's AV
  applies to Soak (items-equipment.md's per-location armour), and a **per-location trauma
  tally** — a small side-counter (not a pool with its own max) tracking how much *unhealed*
  damage that specific location has taken.
- **Concentrated damage = a critical injury** — the owner's key mechanic, now hung off the tally
  instead of a second pool. When one location's tally reaches **≥ a threshold fraction of max
  Health**, that location suffers a **critical injury** (maimed hand → drop weapon/−Dexterity
  there; leg → −Movement; head → Stun/Downed) — *even though* it's the shared total, not a
  location pool, that ran down. The owner's worked example (50 max Health, 25 concentrated in the
  right hand = 50%) is exactly this tally crossing its threshold.
  **Realism refinement (mine, on top of the owner's rule):** the threshold shouldn't be a flat
  50% everywhere — a solid hit to the **head or torso** is disproportionately dangerous compared
  to the same raw damage to a limb (that's basic anatomy, and it's also why WHFRP-style games
  treat head/body crits as the scary ones). So: **limbs use the ~50% threshold, head/torso use a
  lower one (🟡 ~30%)** — a limb can eat a couple of solid hits before it's crippled, a solid hit
  to the head is serious almost immediately. One shared table (`location → thresholdFraction`),
  not per-weapon or per-race special-casing.
  A critical injury clears when the location is **treated/rests** (its tally resets toward 0 as
  Health heals, or on a Healer/infirmary visit — ties into character.md's `physicalState` and the
  Downed→recovery flow below) — it doesn't linger forever like a `physicalState` scar would.
  This gives armour-by-location (items-equipment.md deep layer) a real job and rewards called
  shots, without needing N independent HP pools or a full WHFRP crit-severity table (though a
  small effect table per location is still worth authoring as deep-layer garnish, below).
- **Willpower does not pad Health** (it did in the old Wounds formula, half-weighted). With a
  legible pool that's unnecessary; Willpower stays the Stress/Madness/Fear stat
  (flavor-progression.md) and doesn't double-dip into raw survivability.
- **0 total Health = Downed, never dead** (R8 unchanged). A critical injury to a *vital* location
  (head/torso) can Down you before the total is gone — fast and decisive, per pillar 3.

**Not built** — sparring uses an unrelated placeholder `maxHp` (Implementation, below) that
predates this design; when real combat is built, `health` becomes this pool-plus-locations model
(character.md's `recalculateMaxResources` seam computes the max).

### Soak, damage, and the anti-stalemate rule ⬜ not decided (shape proposed)
- **Soak** = `ConstitutionBonus + Armour Value (AV)` — subtracted from every hit's damage.
  **Always call it AV, never "AP"** — "AP" is Action Points (world-travel.md); a character
  sheet must never abbreviate armour as AP. In the deep layer AV is **per body location**
  (items-equipment.md), so a hit's Soak is that location's armour — pairing directly with the
  hit-location Health model above.
- **Damage** = `weapon Damage + net SL (the opposed margin) + StrengthBonus` (ranged: weapon +
  net SL + a ranged term — see character.md's open Strength/finesse question), minus Soak.
- **Armour ✕ weapon type ✅ direction** (the owner's ask: "slashing weapon is very ineffective
  against plate armor"). A weapon's **damage type** (slash / pierce / impact) meets an armour's
  **type** (cloth / leather / mail / plate) through a small **effectiveness multiplier** applied
  to damage (or to the AV it must beat): slashing glances off plate (×≈0.5), impact (maces,
  hammers) and armour-piercing thrusts do better against it, while slashing shines against the
  unarmoured. One tiny lookup table (`DAMAGE_TYPE × ARMOUR_TYPE`), not per-item special cases —
  it makes weapon choice a real rock-paper-scissors read against what your foe is wearing, which
  is exactly the WHFRP-not-D&D gear-matters goal (items-equipment.md).
- **A connecting hit (margin > 0) always deals ≥1 damage**, regardless of Soak — the deliberate
  fix for **Soak-stalemates** (two armoured defensive builds trading 0s for rounds is a stall,
  not grit). A long fight also accrues **Fatigue** that erodes Soak/defence over time
  (design intent, not detailed).
- High **Mastery** or heavy weapons should **partly pierce AV** at the deep-layer tier; this
  stacks with the type multiplier (a masterful maul crushes plate). Not detailed yet.

**Worked illustration** (numbers illustrative only, now on the R12 Health model): an ermehn
duellist (Melee-tree Effective 55, StrengthBonus 2, dagger Damage 3, slashing) attacks a canid
soldier (Dodge 40, ConstitutionBonus 4, mail AV 4, Health 80). Attacker rolls 22 → SL +3;
defender Dodges, rolls 61 → fail, SL −2. Margin +5 → hit to the arm. Raw = 3 + 5 + 2 = 10;
slash-vs-mail ×0.7 ≈ 7; − Soak (4+4=8) → floored to the **≥1 rule = 1** Health. The dagger
*pings off* the mail — so the ermehn should thrust (pierce) or aim an unarmoured location, or
switch approach. Against a leather-clad or unarmoured foe the same swing bites deep. This is the
gear/type read the multiplier is for; the *numbers* are 🟡.

### Downed, not dead ⬜ not decided (direction locked) *(R8, was P-recovery)*
**No permanent death** in the server game (README.md pillar 3) — an async game can't fairly
kill a character its player couldn't defend in real time. At 0 Health (or a critical injury to a
vital location — R12) a character is **Downed** (knocked out/incapacitated), found and carried to
the **Deltrada infirmary**, then
**Recovering** for a real-time window (no risky actions; light/social ones may still be
allowed). The cost of losing should be **downtime + a temporary injury debuff**, explicitly
**not** confiscated Action Points — taking a week's hoarded AP for one bad fight feels awful
and directly fights the uncapped-AP design (world-travel.md). Fate points (below) can avoid a
knockout outright. **Open:** downtime length (flat, or scaled to how badly the fight was
lost?); whether a scar/injury is rolled; any small coin cost; whether social actions stay
available while Recovering.

### Fate points ⬜ not decided *(was P9)*
A small pool (proposed **2**), each spendable to **reroll a test** or to **shrug off a
knockout** (stay up, lose nothing) — the anti-frustration valve that keeps combat consequential
without turning one bad roll into a grudge. Refreshes slowly on real rest/over time — **not**
"per session," since this is an async game with no sessions. Some races/roles may start with
+1. Not built.

### Combat resolution mode — v1 is auto-resolve, manual is a later upgrade ✅ direction R24 *(owner-decided)*
The owner weighed two shapes and picked a build order rather than picking one forever:
1. **Auto-resolve (v1, build this first).** Before the fight, the player sets up in a small
   menu — **stance** (Aggressive/Balanced/Defensive), optionally a learned **style** (below), and
   a **target** — then presses one button. The engine rolls every round **server-side, in one
   pass**, and the bot narrates the whole fight round-by-round with a short delay between
   messages (exactly the pattern `/smackdown sparring` already ships — see Implementation below).
   No per-round player input once the fight starts.
2. **Manual, turn-by-turn (later, only once v1 proves fun).** Buttons appear **each round** to
   pick a maneuver/called-shot/stance-change live, turning a fight into a real back-and-forth.
   Explicitly **not v1** — the owner's instruction is to prove the automatic version feels good
   first, then layer manual control on top, not build both at once.

**Why this order, not the reverse:** auto-resolve reuses the sparring engine's already-working
narration pattern (zero new UI risk) and is what an *async* server needs anyway — most fights
won't have both participants staring at Discord at the same moment, so a manual per-round UI
would often just be one player clicking through both sides' turns alone. Building the setup-menu
+ style/stance layer first also means **manual mode, when it comes, is additive** — the same
stance/style/target selection feeds either resolver; a manual round is just "ask before each
roll instead of rolling them all." No architecture gets built now that manual mode would have to
tear down.

The engine should still model **Side A vs Side B**, each a list of combatants, so 1v1 duels,
1-vs-many PvE, and future parties are all the same code path (a party is just more entries on a
side) — this holds for both resolution modes. **Initiative** = `AgilityBonus + PerceptionBonus`
(+ optional tiebreak roll); the auto-resolve layer uses one roll per *side* instead of per
combatant for speed and narration brevity.

**Stances — SUPERSEDED by D41 fighting styles.** The planned casual Aggressive/Balanced/
Defensive stance layer was absorbed into the style catalog before it was ever built: "no
style" is the balanced default, Striker/Onslaught are the aggressive handle, Stonewall/Warden
the defensive one — with the difference that a style is also *knowledge* (a trained node), not
just a toggle. The inert `stance` field on `CombatProfile` was removed with it. **Conditions**
(small, stacking, shown as an emoji row, 🟡): Bleeding, Prone, Stunned, Fatigued, **Shaken**
(high Stress — flavor-progression.md), Broken (fled in fear) — not built; the D41 hamper
("tangled") is the first condition-shaped thing the narration shows.

The original design docs carried a full worked example of this whole flow — a fighting-style
duel (Rhett the ermehn duelist, finesse damage, Dagger-Dueling maneuvers) and a Brawling spire
bout (Bork vs Rhett, striking + occasional clinch, ending in a non-lethal KO) — illustrative
only, same spirit as the Smithing example in skills.md; re-author a fresh worked example here
once styles/moves are actually built rather than resurrecting the old one verbatim.

**Combat is also meant to deepen** (design direction, nothing built): weapon **skill trees**
(skills.md already ships placeholder Melee/Ranged/Brawling roots for this), learnable
**fighting styles** (schools of maneuvers — the deep-layer face of a stance, canon-grounded:
tamian Tenets of Tesque, ermehn dagger-dueling, canid shield-wall drill, lutren Sea Guard,
polcan boarding), and a separate **Brawling** tree built specifically for the Smackdown Spire
(striking-first: punches/kicks/natural weapons as the core, with clinch/ground as thin,
occasional spice rather than a co-equal positional system — keeps spire duels fast and
readable). **Scope discipline, stated explicitly by design:** v1 should be *one* weapon branch,
*one* style, Brawling with ~3 moves — prove one fight feels good before building the whole
arsenal.

### Combat styles & counter-play ✅ v1 BUILT (D41) / counter-play deferred *(owner-requested)*
The owner wants styles that *interact*, not just flat buffs. **The v1 style system is live** —
see the Reference block above for the full built shape (family-specific catalogs, node-backed
proficiency, modifiers + effects, the combat plan with conditional switches). Design notes that
still matter:
- **A style shapes the fight, with trade-offs.** Built as the modifiers/effects mix: Striker
  trades guard for pressure, Grappler trades raw output for control (hamper), Stonewall/Warden
  trade offence for defence + the riposte. The owner's further levers (speed/initiative, Fatigue
  cost, reach preference) remain seams on the same catalog — a new lever is a field + one engine
  step, exactly like `hamper`/`riposte` were.
- **Styles as skill nodes.** Landed as designed: each style draws on (and trains) a tree branch —
  the owner's added rule *"the better you know your active style, the better you also defend in
  it"* is exactly the defence drawing on the style node's path. The style choice itself is free
  to switch (no unlock): proficiency, not permission, is the gate. **Named canon schools**
  (tamian Tenets of Tesque, ermehn dagger-dueling, canid shield-wall, lutren Sea Guard, polcan
  boarding) stay a LATER layer — learned/requirement-gated talents that sit on top of (or
  replace) the generic six, once talents exist (skills.md R13).
- **Knowing a style helps you counter it** — ⬜ still deferred. The `knowsStyle` familiarity
  bonus (defence/read bonus against a style you've trained) now has an obvious data source —
  the defender's points on the attacker's active style's node — so the seam is even cheaper
  than designed: an opposed-check modifier keyed on the defender's path sum for
  `attacker.activeStyle`. Not built (v1 keeps the opposed roll clean).
- **Ranged has styles too, thinner.** Per the owner, ranged gets its own shooting styles
  (aimed/steady vs fast/volley, hold-and-loose) but **deliberately less extensive** than melee.
  The catalog's `family: 'ranged'` is typed and validated; no ranged styles are authored until
  ranged combat exists in the engine.

### Named signature moves ✅ direction (nothing built) *(owner-requested, spire-flavored)*
Distinct from styles: discrete **named techniques** with flavor and a mechanical kick — the
owner's "special moves with names like in wrestling or MMA (spinning wheel kick, etc.)". These
are the **Smackdown Spire's** headline color (below): a move is a talent/skill node granting a
maneuver with a name, a setup condition, and an effect (a big-damage risky strike, a stun, a
throw, a crowd-pleasing finisher). They read great in Tosche's narration ("and there it is — the
**Tumbling Otter Slam!**"). Weapon combat gets a soberer version (named strikes/guards tied to a
style); Brawling gets the flashy wrestling/MMA vocabulary. **Scope:** ~3 Brawling moves in v1,
per the discipline note above.

### Positioning & terrain ⬜ future consideration, not v1 R25 *(owner-flagged explicitly as later)*
The owner explicitly wants this on record as a direction, while being explicit it's **not now**:
- **A lightweight positional grid.** Not a full tactical battle-map — a small abstract
  representation of where combatants stand relative to each other (adjacent/at range/flanked),
  enough to matter for reach weapons, ranged vs melee, and multi-combatant fights (Side A vs Side
  B already assumes a list of combatants, above — position is the natural next axis on that same
  model, not a new one).
- **Terrain and obstacles constrain what's viable, not just flavor.** The owner's own examples:
  a **cramped room** should make a **two-handed weapon** genuinely awkward to swing (a penalty or
  an outright block on reach/two-handed attacks); **sand/loose footing** should hinder a specific
  **style** (one that relies on fast footwork loses its edge, a grappling-heavy style might not
  care). This means terrain needs to be tagged with small, reusable properties (`cramped`,
  `uneven`, `slick`, `open`) that styles/weapons/maneuvers can check against — the same
  "one small reusable language, many consumers" shape the project already uses for
  `LocationCondition` (world-travel.md) and `DAMAGE_TYPE × ARMOUR_TYPE` (above): a lookup, not a
  simulation.
- **Why deliberately deferred:** this is real scope — a grid, terrain tags, and every style/
  weapon's interaction with them is a second combat system layered onto the first. Building it
  before the R24 auto-resolve v1 (and before styles/moves even exist) would be solving a problem
  three layers too early. It belongs here so a **future** manual/tactical combat mode (R24's
  option 2) is designed *with* positioning in mind from day one, rather than retrofitted after
  the fact and forced to redo styles/maneuvers to account for space.

### Smackdown Spire — arena modes ✅ sparring / ⬜ duel & trial *(was P-arena)*
A dedicated fight venue in Deltrada, with three intended modes:
- **Sparring** — for-fun, no real stakes. **Built** (below).
- **Duel** — real Health/damage, 0 = knockout, an optional wager (currency/item stake).
- **Trial / PvE** — fight stronger NPCs for rewards, real stakes (knockout + recovery).

**Consent rule (locked, load-bearing for async fairness):** any fight with real stakes (a Duel
with real damage/wager, or a staked PvE trial) starts **only after the target accepts by
button** — a player can never be attacked into real losses while offline. Stakeless Sparring
needs no consent.

**One engine for the spire and the field ✅ direction** (the owner's ask: "smackdown spire and
normal combat should use similar combat engine"). The real Duel/Trial modes run on the **same
opposed-d100 / Health / Soak engine** as any other fight (Side A vs Side B, above) — the spire is
a *venue and ruleset overlay*, not a separate combat system. What the spire adds on top:
- **Hand-to-hand *and* weapon bouts** (owner's ask): the spire offers both — a **Brawling** bout
  (unarmed, the wrestling/MMA flavor) or an **armed** bout (weapons allowed) — the player picks
  the bout type; the same engine resolves either, just with the Brawling tree vs a weapon tree
  (skills.md) driving the attack.
- **Spire-only signature moves** — the named wrestling/MMA techniques above are *especially* a
  spire thing: unarmed bouts lean into flashy named finishers for crowd appeal and Tosche's
  commentary, where a grim field skirmish would not. Some moves may be **spire-exclusive**
  (showboating that only makes sense before a crowd).
- **Non-lethal by venue rule** — spire knockouts are "dust yourself off," lighter than a
  battlefield Downing (an open question below is exactly *how* much lighter).

---

## Implementation

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

Currently consumed by: **travel challenges** (world-travel.md). **Not yet consumed by**: combat
(sparring predates this engine and uses its own placeholder, below) or crafting (no crafting
exists yet).

### SmackdownRecord — `db/models/smackdownRecord.ts` ✅
One doc per `Character._id`: `{characterName, eloRating (default 1000), wins, losses}`.
`characterName` is denormalized so the leaderboard (`/leaderboard`) needs no join. Per
character, not per account (character.md's Account↔Character split).

### Sparring — `/smackdown sparring` ✅ for-fun tier / 🟡 numbers *(D16)*
Fights both players' **active characters**, no approval required. Locks both characters
(`runExclusive`), resolves the whole fight in memory, narrates round-by-round in
`#smackdown-spire` with delays, and commits only **per-character ELO** at the end — it does
**not** persist HP (a fantasy match). ELO here is explicitly temporary and will be removed from
sparring once the serious Duel mode exists (Ruleset above). **This is already the R24 auto-
resolve shape** (in-memory rounds, one narrated pass, no per-round input) — the real Duel/Trial
combat engine doesn't need to invent the resolution pattern, only replace what's rolled each
round (d100/Health/Soak instead of the placeholder d20/maxHp below).

`game/combat/stats.ts` derives **placeholder** combat stats per character:
`attributeBonus(v) = floor(v/10)`; `maxHp = strengthBonus×5 + willpowerBonus×5 +
constitutionBonus×10` (ported from the old bot's `getMaxHp`); `attackBonus = weaponSkill +
strengthBonus` where `weaponSkill` = the character's trained points in the `melee` +
`brawling` skill-tree roots (skills.md); `defenseBonus = agilityBonus + constitutionBonus`.
`game/combat/engine.ts` resolves rounds as `d20 + attackBonus` vs `d20 + defenseBonus` — this
is a **different, older engine** than `checks.ts`'s d100 system, kept only because sparring is
explicitly fantasy/for-fun and nothing here needs to match the real ruleset. Since D25 gave
attributes real per-race/point-buy values, sparring outcomes aren't fully random anymore, but
the maxHp/attack/defense **shape itself is throwaway** — it will be replaced wholesale when the
Health/Soak/opposed-d100 combat above (R12) is actually built.

### Duel — `/smackdown duel` + the real engine ✅ v1 / 🟡 numbers *(D35)*
The serious tier (owner-requested, superseding the D14 "no combat mechanics" stance for the *v1
model*, as D25/D34 did for attributes/skills). Three pieces:
- **`game/combat/duel.ts`** — the pure resolver. Each exchange is an **opposed d100** (both roll
  their own `checks.ts` test; the higher Success Level connects, skill-tiebreak else defender);
  damage = `weapon + net SL + StrengthBonus − Soak`, floored to the **≥1 connecting-hit** rule;
  auto-resolved in one alternating-exchange pass (the sparring narration shape on real math).
  Fields for the deferred layers (`damageType`, `stance`) are carried but **inert**, and
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
- **`/character combat`** (`combatplan` handler + `_combatPlanView.ts`) — the plan panel:
  ephemeral/personal/stateless (the `/profile` pattern), a default-style select per family
  (each option shows the trained path points), a two-step rule builder (discrete trigger menu →
  style; the half-built rule rides the customId), clear-rules per family. A plan edit is one
  atomic per-family `$set` — no lock needed (a fight snapshots the plan under ITS lock).
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
  one record set by a catalog-chosen field (**Ranking** = ELO, **Most Victories** = wins today);
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

---

## Open questions

- **Difficulty ladder values** *(P11)* — the 6-step ladder shape (one band at a time, no
  stacking) is settled; the exact `+40…−30` numbers are 🟡 pending playtesting.
- **~~Wounds~~ → Health pool + hit-location trauma tally, resolved (R12):** the *model* is decided
  (one shared pool, never split; a per-location tally drives critical injuries, limbs ~50%/vitals
  ~30% thresholds). Open *numbers*: pool size + the frame/Constitution formula, the exact
  threshold fractions per location, the tally's decay/reset rule (does it shrink with Health regen,
  or only clear on treatment?), and the target "~3 solid hits to Down."
- **Armour ✕ weapon-type multipliers** *(R12)* — the `DAMAGE_TYPE × ARMOUR_TYPE` table values
  (how hard slash glances off plate, how much impact/pierce gains), and whether it scales damage
  or the AV threshold.
- **Fate points** *(P9 → R21, owner now wants them)* — pool size (proposed 2), refresh rule
  (slow on rest, not per-session), which races/roles start with a bonus.
- **Criticals/fumbles on doubles** *(P10 → R21, owner now wants them)* — the *rule* is in
  (double = crit on success / fumble on failure). Open: crit & fumble **table** contents, how
  they interact with the hit-location critical-injury rule, and whether the deep Injury table
  ships v1 or later.
- **Recovery specifics** *(P-recovery)* — downtime length, whether a scar is rolled, any coin
  cost, social-action availability while Recovering.
- **Arena modes** *(P-arena)* — which modes ship for v1; whether an arena knockout triggers
  full §-recovery or a lighter "dust yourself off"; wager rules; challenge/matchmaking flow.
- **Combat depth** *(P-combat)* — the weapon tree's primary split (grip 1H/2H vs weight
  light/heavy as the top branches); how much of "weapon category" lives in the weapon tree vs
  the fighting style; v1 scope (recommendation: one weapon branch, one style, ~3 Brawling
  moves).
- **Combat styles & counter-play** *(R12/owner — v1 shipped, D41)* — the launch six and their
  numbers are 🟡 first guesses (modifier sizes, hamper −15, riposte ≥2 SL / 1–3); open: the
  `knowsStyle`-vs-attacker defence bonus size (and whether it reads off the defender's points
  on the attacker's style node), ranged styles (when ranged combat exists), more effect kinds
  (initiative/Fatigue/reach levers), and whether deeper style-branch leaves (a Striker
  sub-tree) are worth the content.
- **Named signature moves** *(owner)* — the ~3 v1 Brawling moves (names + setup + effect); which
  are spire-exclusive; how a move is unlocked (talent/skill node) and triggered (auto by the bot
  vs a picked maneuver in the deep layer).
- **Spire bout parity** *(owner)* — armed vs unarmed bouts on the one engine: do weapons simply
  win unarmed bouts (realistic) so the spire mostly runs Brawling, or is there matchmaking/
  handicapping; how spire knockout ("dust yourself off") differs from a field Downing.
- **~~Combat UX/automation~~ → resolved (P15 → R24):** v1 is auto-resolve (pre-fight menu, one
  narrated pass), manual/turn-by-turn is later. Still open: exact round pacing/delay, and
  side-initiative vs individual within the auto-resolve narration.
- **Armour/bronze weight** *(P16)* — v1 = one global AV per armour set? Bronze as one quality
  tier up, gated by rarity/cost (item-equipment.md's economy tie-in).

---

## Expansion ideas & risks

**Risks:**
- **Surface area is large for a button-driven game.** Hit-location trauma tallies + armour ✕
  weapon-type + criticals/fumbles + styles + counter-play (`knowsStyle`) + named moves is a lot of
  interacting systems. Individually each is simple; a casual fight resolving **all of them at
  once** in one narrated pass risks being unreadable ("why did I lose that?"). Mitigation already
  in the design: auto-resolve (R24) means the player never has to *track* this live — the bot
  narrates the outcome in plain language ("your dagger skids off his mail — try a thrust next
  time") rather than showing the math. Keep that discipline as more of this gets built: the
  narration is the UI, the numbers stay backstage.
- **`knowsStyle` counter-play punishes new players asymmetrically.** A veteran who's learned 5
  styles gets a defence bonus against all 5; a fresh character has learned none and gets none —
  which is fine as a progression reward, but could feel like "I lose before I even swing" in an
  early PvP encounter. Consider a small flat baseline read-bonus for *any* trained combat skill
  (not just a matching style) so a novice isn't defenceless against styles they've never seen.
- **Spire named moves risk becoming the only build that matters** if a handful of flashy Brawling
  finishers heavily outperform sober weapon combat — v1's ~3-move scope limit is the right
  guardrail; re-check balance before adding move #4.

**Expansion ideas:**
- **A "scouting" mechanic for counter-play** — let a character safely observe/spar an NPC known
  to use a particular style (npcs.md) purely to learn its tells (a small `knowsStyle` credit)
  without adopting the style themselves — gives the counter-play system a non-grindy on-ramp and
  another reason to visit NPC trainers.
- **Crowd/reputation flavor for the Spire** — once factions.md's reputation exists, a popular
  fighter's bouts could draw a bigger in-character "crowd reaction" line, and wins/losses could
  nudge a small local-reputation value with the Spire's regulars — cheap narrative payoff reusing
  existing systems, no new mechanics.
- **A Fate-point flavor hook** — spending a Fate point to shrug off a knockout could optionally
  trigger a one-line "against all odds" chronicle post (world-travel.md's chronicle channel) —
  makes a clutch moment visible to the server, not just the fighter.
