# Combat — the core test, Wounds, Smackdown

See [README.md](README.md) for the legend. The **d100 test** described here is not
combat-only — it's the one mechanic every risky action in the game uses (skills.md's skill
checks, world-travel.md's travel challenges, and combat below all roll the same way).

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

### Criticals & fumbles ⬜ not decided *(was P10)*
Proposed: rolling doubles (11, 22, … 99) is a critical on a success, a fumble on a failure.
Casual layer gets a flavorful line; deep layer would roll a combat critical on an Injury table.
Deliberately deferred — it's a whole table to author and balance, not needed to prove the core
loop.

### Wounds — low, gritty, not a HP bar ⬜ not decided (formula proposed) *(was P8)*
Proposed formula: `Wounds = StrengthBonus + 2×EnduranceBonus + ⌊WillpowerBonus/2⌋ ± Size`,
typically landing **7–13** — deliberately low (pillar 3 in README.md: fast, consequential
fights, not HP-bloat attrition). **Willpower is deliberately half-weighted**: it's also the
governing stat for Stress/Madness resistance (flavor-progression.md), so a *full* weight in
Wounds too would make it a clean super-stat that out-scales Strength/Endurance for raw
survivability — halving it keeps "grit toughens the body a little" true without that
double-dip. At 0 Wounds you're **Downed**, never dead (below). Owner's framing: not committed
to this exact formula, or even to "Wounds" as the name — could be something other than a
WHFRP-style Wounds pool; open to a better idea. **Not built** — sparring uses an unrelated
placeholder `maxHp` (Implementation, below) that predates this design.

### Soak, damage, and the anti-stalemate rule ⬜ not decided (shape proposed)
- **Soak** = `EnduranceBonus + Armour Value (AV)` — subtracted from every hit's damage.
  **Always call it AV, never "AP"** — "AP" is Action Points (world-travel.md); a character
  sheet must never abbreviate armour as AP.
- **Damage** = `weapon Damage + net SL (the opposed margin) + StrengthBonus` (ranged: weapon +
  net SL + a ranged term — see character.md's open Strength/finesse question), minus Soak.
- **A connecting hit (margin > 0) always deals ≥1 Wound**, regardless of Soak. This is the
  deliberate fix for **Soak-stalemates**: two heavily-armoured defensive builds trading 0s for
  rounds is not fun and not gritty, it's a stall. A long fight should also accrue Fatigue that
  erodes Soak/defence over time (design intent, not detailed).
- High **Mastery** or heavy weapons should **partly pierce AV** at the deep-layer tier — not
  detailed yet.

**Worked illustration** (numbers illustrative only): an ermehn duellist (Melee-tree Effective
55, StrengthBonus 2, dagger Damage 3) attacks a canid soldier (Dodge 40, EnduranceBonus 4,
leather AV 1, Wounds 13). Attacker rolls 22 → SL +3; defender Dodges, rolls 61 → fail, SL −2.
Margin +5 → hit. Damage = 3 + 5 + 2 = 10, − Soak (4+1=5) = **5 Wounds**. Canid drops to 8 —
gritty (not a one-shot), but roughly three clean hits put him Down.

### Downed, not dead ⬜ not decided (direction locked) *(R8, was P-recovery)*
**No permanent death** in the server game (README.md pillar 3) — an async game can't fairly
kill a character its player couldn't defend in real time. At 0 Wounds a character is
**Downed** (knocked out/incapacitated), found and carried to the **Deltrada infirmary**, then
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

### Combat flow, casual vs deep ⬜ design only
The engine should model **Side A vs Side B**, each a list of combatants, so 1v1 duels,
1-vs-many PvE, and future parties are all the same code path (a party is just more entries on a
side). Casual UI: pick a **stance** + a **target**, press a button, the bot rolls and narrates
each round with a short delay. Deep UI: maneuvers, called shots, positioning, individual
initiative. **Initiative** = `AgilityBonus + PerceptionBonus` (+ optional tiebreak roll); the
casual layer may use one roll per *side* instead of per combatant for speed.

**Stances** (the casual tactical handle, 🟡): **Aggressive** (+hit/+damage, −defence) ·
**Balanced** (no modifier) · **Defensive** (+Dodge/Parry, −hit). A stance is meant to be the
auto-face of a deep-layer fighting style (below) — the casual just picks one and presses
Attack. **Conditions** (small, stacking, shown as an emoji row, 🟡): Bleeding, Prone, Stunned,
Fatigued, **Shaken** (high Stress — flavor-progression.md), Broken (fled in fear). None of
this is built (Implementation, below).

A full worked example of this whole flow — a fighting-style duel (Rhett the ermehn duelist,
finesse damage, Dagger-Dueling maneuvers) and a Brawling spire bout (Bork vs Rhett, striking +
occasional clinch, ending in a non-lethal KO) — is kept in the archived `RPG/Examples.md`
(not migrated verbatim; every number there is illustrative, same as the Smithing example in
skills.md).

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

### Smackdown Spire — arena modes ✅ sparring / ⬜ duel & trial *(was P-arena)*
A dedicated fight venue in Deltrada, with three intended modes:
- **Sparring** — for-fun, no real stakes. **Built** (below).
- **Duel** — real Wounds, 0 = knockout, an optional wager (currency/item stake).
- **Trial / PvE** — fight stronger NPCs for rewards, real stakes (knockout + recovery).

**Consent rule (locked, load-bearing for async fairness):** any fight with real stakes (a Duel
with real Wounds/wager, or a staked PvE trial) starts **only after the target accepts by
button** — a player can never be attacked into real losses while offline. Stakeless Sparring
needs no consent.

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
sparring once the serious Duel mode exists (Ruleset above).

`game/combat/stats.ts` derives **placeholder** combat stats per character:
`attributeBonus(v) = floor(v/10)`; `maxHp = strengthBonus×5 + willpowerBonus×5 +
enduranceBonus×10` (ported from the old bot's `getMaxHp`); `attackBonus = weaponSkill +
strengthBonus` where `weaponSkill` = the character's trained points in the `melee` +
`brawling` skill-tree roots (skills.md); `defenseBonus = agilityBonus + enduranceBonus`.
`game/combat/engine.ts` resolves rounds as `d20 + attackBonus` vs `d20 + defenseBonus` — this
is a **different, older engine** than `checks.ts`'s d100 system, kept only because sparring is
explicitly fantasy/for-fun and nothing here needs to match the real ruleset. Since D25 gave
attributes real per-race/point-buy values, sparring outcomes aren't fully random anymore, but
the maxHp/attack/defense **shape itself is throwaway** — it will be replaced wholesale when the
Wounds/Soak/opposed-d100 combat above is actually built.

### What's missing entirely
- The Wounds/Soak/Downed formulas above — design only, no `Wounds` field on `Character`, no
  damage/soak calculation using `checks.ts`.
- Fate points — no field, no spend path.
- The serious `/smackdown duel` and `/smackdown trial` — no code; will be the next
  `ActivitySession` consumer after the travel `challenge` handler (world-travel.md), reusing
  its crash-safe step-guarded pattern for a turn-based fight.
- Weapon skill trees beyond the placeholder roots, fighting styles, Brawling moves — none
  exist; `melee`/`ranged`/`brawling` nodes in `game/data/skills.ts` are unused stubs today.
- Criticals/fumbles, Initiative, Fatigue, Conditions (Bleeding/Prone/Stunned/Shaken/Broken) —
  none built.

---

## Open questions

- **Difficulty ladder values** *(P11)* — the 6-step ladder shape (one band at a time, no
  stacking) is settled; the exact `+40…−30` numbers are 🟡 pending playtesting.
- **Wounds formula & lethality** *(P8)* — is `SB + 2×EB + ⌊WPB/2⌋ ± Size` right, or should the
  server game use something other than a WHFRP-style Wounds pool entirely? Target: a starting
  fighter should take ~3 solid hits to go Down.
- **Fate points** *(P9)* — pool size, refresh rule, which races/roles start with a bonus.
  Owner: not for now, revisit later.
- **Criticals/fumbles on doubles** *(P10)* — include from v1 or defer to v1.1 with the Injury
  table. Owner: not for now.
- **Recovery specifics** *(P-recovery)* — downtime length, whether a scar is rolled, any coin
  cost, social-action availability while Recovering.
- **Arena modes** *(P-arena)* — which modes ship for v1; whether an arena knockout triggers
  full §-recovery or a lighter "dust yourself off"; wager rules; challenge/matchmaking flow.
- **Combat depth** *(P-combat)* — the weapon tree's primary split (grip 1H/2H vs weight
  light/heavy as the top branches); how much of "weapon category" lives in the weapon tree vs
  the fighting style; v1 scope (recommendation: one weapon branch, one style, ~3 Brawling
  moves).
- **Combat UX/automation** *(P15)* — side-initiative vs individual in the casual layer; exact
  round pacing/automation depth. Depends on P1/P2 (already resolved — see README.md R5/R6).
- **Armour/bronze weight** *(P16)* — v1 = one global AV per armour set? Bronze as one quality
  tier up, gated by rarity/cost (item-equipment.md's economy tie-in).
