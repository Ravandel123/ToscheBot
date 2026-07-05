# Professions — foraging, fishing, gardening, cooking

See [README.md](README.md) for the legend and the shared file shape.

The peaceful gameplay loops. They're grouped in one file (R16/R17) because they share the same
skeleton — **spend AP at a place → roll a skill check → get instance items with per-instance
quality** — and feed each other (forage/fish/garden produce ingredients; cooking turns
ingredients into meals; smithing turns ore into gear — skills.md). Each is a **skill tree**
(skills.md) and each output is an **item instance** (items-equipment.md). Grouping keeps the
shared machinery (gather → identify → quality → produce) designed once; if `cooking` outgrows
this file it can split later.

> These are the owner's flagged "very extensive" systems. Below is the design; **almost none of
> it is built** — the shared substrate (skills, items, locations, checks, the game clock) exists,
> the profession content does not.

---

## Reference (decided data & math)

**Shared gather loop** (all four): at a location whose `resourceNodes` include the profession's
resource, spend AP → `rollCheck` (profession skill vs a node difficulty, race affinities apply)
→ yield 0..n **item instances**; **quantity scales with Success Levels**, **quality** (the shared
0–4 tier, items-equipment.md R23 — displayed via that item family's own name row, e.g. a fish
shows "Prize Catch" not "Masterwork") **scales with skill/SL** (skills.md's surplus→quality
model, shared with smithing).

**Profession skill trees** (skills.md; ⬜ content):

| tree | root attribute (blend) | leaves sketch |
|---|---|---|
| Foraging / Herbalism | Intelligence + Perception | Mushrooms, Herbs, Fruit & Forage, **Identify** |
| Fishing | Dexterity (+ Perception) | Angling, Netting, Deep-water |
| Gardening / Farming | Intelligence (+ Constitution) | Sowing, Tending, Harvest, Cross-breeding |
| Cooking | Dexterity + Intelligence | Baking, Roasting, Brewing, Preserving |

**Foraged-item identification** (R16) — a gathered natural item instance carries:
`identified: boolean`, `apparentItemId?` (what the player *believes* it is when misidentified),
`descriptorId?` (which generic "unknown" name to show while unidentified). Hidden until
identified: true `itemId`, real stats/effects.

**Cooking food stats** (R17, per meal instance, 0–100 unless noted):
- Flavor: `sweet, sour, salty, bitter, spicy, umami`
- Texture: `crunchy, smooth, chewy`
- Hidden: `complexity` (# distinct ingredients), `temperature` (Hot / Room / Chilled),
  `freshness` (decays over time), `nourishment` (→ resource restore), `quality` (from the check)
- Effect = base restore + buffs, **modulated by the eater's likes/dislikes** (character.md).

---

## Ruleset

### The shared skeleton ✅ direction R16
Every profession is the same three beats so the bot and the player learn it once:
1. **Go where the resource is.** Locations declare `resourceNodes` (world-travel.md's static
   location data): a riverbank has fish + reeds, a woodland has mushrooms + herbs, owned land
   has crop plots. A place with no node for a profession simply doesn't offer it (the `/play`
   hub gates the action by `availability`, D31).
2. **Roll the profession skill.** A d100 check (combat.md engine) against a node difficulty,
   with **race affinities** (a lutren fishes/forages riverbanks better; a tamian forages
   woodland canopy). Meaningful ⇒ it credits skill use (skills.md's `creditUse`) — professions
   are a **natural first `creditUse` consumer** (skills.md flags this gap).
3. **Get instances with quality.** Output is item instances (items-equipment.md); count scales
   with SL, quality with skill. This reuses the exact quality-from-a-check pipeline smithing
   wants (skills.md) — build it once, all professions + crafting share it.

### Foraging — identification & the misidentification gamble ✅ direction R16
The headline mechanic, and the owner's best idea in this batch. You can pick things you don't
recognize:
- **Unidentified items.** A forage yields an instance flagged `identified: false`. It shows a
  **generic descriptor** from a hardcoded per-family pool — never a flat "a mushroom" but
  `"a red-capped mushroom"`, `"a speckled toadstool"`, `"a pale, waxy berry"` — with its real
  name and stats **hidden**. Descriptor pools live in code per item family (D10) and are chosen
  by the item's visual traits, so two different mushrooms can share the "red-capped" look — the
  ambiguity is the point.
- **Identify check.** A **Herbalism/Identify** skill check (Intelligence+Perception) reveals the
  true item + stats. A trained forager mostly knows what they picked on the spot (high skill →
  auto-identify common finds); a novice hauls home a bag of mysteries.
- **Misidentification** (the gamble). A *failed but not fumbled* identify doesn't just say
  "unknown" — it can **confidently mislabel** the item: it now displays as a **plausible wrong
  item** (`apparentItemId`), stats and all, until the truth surfaces — on **consumption**, on a
  **re-check** (by you later, or a more skilled character/NPC), or on a **critical**. Eating a
  "healing poultice herb" that was actually a purgative is exactly the dark-humor beat Tosche
  narrates. Wrong labels lean *plausible*, never random (a mushroom mis-IDs as another mushroom).
- **Why it's great and safe for casuals:** the casual just forages and the bot auto-identifies
  what their skill covers; only the deep-layer forager pushes into risky wild harvests. Fully
  auto-managed by default (pillar 6).

### Fishing — rods, lures, and per-water tables ✅ direction (ported & bounded)
Reworks the old bot's fishing (root `CLAUDE.md`'s OldBot reference) onto the new spine:
- **Gear modifies the roll and the table.** A **rod** type and a **lure/bait** (items —
  items-equipment.md) shift the fishing check and/or bias the fish table (a fly lure favors
  surface fish; a deep rig reaches bigger quarry). Better gear = better odds/rarer fish, a real
  reason to acquire tackle.
- **Each water has its own fish.** A location's `resourceNodes` name its **fish table**
  (world-travel.md); the riverbank ≠ a deep lake ≠ the coast. Weather/time (D31 living
  locations) can bias it (fish bite at dusk, storms churn up rarities).
- **Fish are instances** with a per-instance **weight** (the old "biggest catch" bragging
  right) — bounded per D10/D32 (never the old unbounded `gFishing.fish[]`: the catch lands in
  the pack/stash like any item, subject to encumbrance).

### Gardening — land, time, and the CRON ✅ direction (ties to property + world)
- **Buy land / a plot.** A character can own a **garden plot** (a property — economy.md/world;
  a new owned thing beyond the pack/stash). Plots are location-bound (your plot is *somewhere*).
- **Plant → grow → harvest.** Sow **seed items** into plot slots; growth advances on the hourly
  **CRON** through stages (seed → sprout → mature → harvestable), biased by **weather** and
  **season** (the game clock, D31) and by Tending actions (weed/water — AP sinks that raise
  yield/quality). Harvest yields crop instances (ingredients for cooking).
- **Cross-breeding** (deep) — combine two crop strains for new/better variants (feeds the
  "many named apple varieties" idea below). Optional, later.
- This is the async-friendliest profession: you plant, walk away for real days, come back to a
  harvest — perfect fit for the uncapped-AP, come-and-go design (world-travel.md).

### Cooking — the flavor engine ✅ direction R17
The owner's most detailed ask, and the system that gives *likes/dislikes* (character.md) and
*Stress relief* (flavor-progression.md) something to bite on:
- **Ingredients carry flavor.** Every edible (foraged, fished, farmed, bought) has the flavor /
  texture / hidden stats in the Reference table. A tart fruit is high `sour`; smoked fish high
  `salty`+`umami`; a chili high `spicy`.
- **A dish is composed from its ingredients.** A recipe defines the method (Bake/Roast/Brew/
  Preserve — the Cooking leaves) and how ingredient stats **combine** into the meal's stats
  (weighted blend + method modifiers: roasting deepens `bitter`+`umami`, brewing raises `sour`).
  The produced **meal is a dynamically-composed instance** — same problem and same solution as a
  dynamically-forged weapon (items-equipment.md's material composition): store the chosen
  ingredients + a **snapshot of the computed stats** on the meal instance (D10 rule 4's
  snapshot exception), so the meal is self-describing without recomputing from a recipe that
  might change.
- **Complexity & temperature are double-edged.** High `complexity` (many ingredients) delights a
  gourmand but *alienates* a character who likes plain food (their likes/dislikes decide).
  `temperature` and `freshness` decay: a piping-hot roast is a great buff *now*, a cold leftover
  much less — a soft push toward cooking fresh, and a use for Preserving.
- **Effect = nourishment + buff, filtered by the eater.** A dish restores resources (health/
  stamina) and can grant timed buffs or **Stress relief** (flavor-progression.md — comfort food
  in the tavern) or a **cure** (an identified herb dish treating a sickness — physical state,
  character.md). Crucially the *same dish helps different characters differently*: it lands
  **better if it matches the eater's likes** (a sweet-tooth loves the honeyed cake) and **worse
  or backfires on a dislike** (serve fish to someone who hates it → little benefit, maybe
  −morale). This is where likes/dislikes stop being flavor text and become a mild mechanic.
- **Variety with invented names.** Ingredients come in **variants** that differ in stats, not
  just quality — the owner's apple example (Granny-Smith-tart vs Honeycrisp-balanced vs
  Red-Delicious-mild) rendered with **made-up BtWD names**, never real-world ones. Variants are
  catalog entries (D10); which variant you get depends on where/what you foraged/grew.
- **Casual vs deep.** Casual — pick a known recipe, the bot uses your best ingredients, you get
  a solid meal; or just "cook something," and it feeds you. Deep — engineer flavor profiles to a
  target eater/effect, discover recipes by experimentation, chase quality via the Cooking skill,
  run a kitchen/tavern (a Role, skills.md).

### Professions as identity ✅ direction
Each maps cleanly to a **Role** (skills.md): Forager/Herbalist, Fisher, Farmer, Cook/Tavern
Keeper — with role growth-bonuses and special actions. A profession is a full "peaceful career"
alternative to fighting, which a friends-server with non-combatant players wants.

---

## Implementation

⬜ **Nothing profession-specific is built.** What exists to build on: the skill-tree engine +
`creditUse` seam (skills.md), the item-instance + quality model (items-equipment.md), the
location graph + living-location weather/time + the `/play` hub action seam + AP spend
(world-travel.md), the d100 check engine (combat.md). Likely build order:
1. **Foraging** first — smallest, and it exercises the two reusable novelties (identification/
   misidentification + quality-from-a-check) that fishing/cooking then reuse. Needs:
   `game/data/foragables.ts` (families + descriptor pools + variants), an `Identify` skill leaf,
   the `identified/apparentItemId/descriptorId` instance fields (items-equipment.md), a forage
   hub action + resolver crediting skill use.
2. **Fishing** — port the old tables onto `resourceNodes` + rod/lure gear modifiers.
3. **Cooking** — the flavor engine + dynamic meal composition + likes/dislikes hook.
4. **Gardening** — needs a property/plot model + a growth CRON; heaviest new infra, do last.

Shared prerequisites these force into existence (all flagged elsewhere as "not built"):
skills' first `creditUse` consumer, items' quality-from-a-check, and a **loot/output source
beyond `/item grant`** (items-equipment.md's open question — professions *are* the answer).

---

## Open questions

- **Grouping** — keep foraging/fishing/gardening/cooking in one file, or split cooking (the
  "very extensive" one) into its own once authored? Recommendation: build foraging+fishing
  together, spin cooking out only if it dwarfs the rest.
- **Identification storage & descriptor pools** — confirm the three-field instance shape
  (`identified/apparentItemId/descriptorId`) and how descriptors map to item "look" so mis-IDs
  stay plausible; whether NPCs (an apothecary — npcs.md) can identify for a fee.
- **Cooking composition math** — the exact ingredient-stat → dish-stat formula and method
  modifiers; how many flavor axes to actually ship (the 6 flavor / 3 texture / hidden set is a
  proposal); how big and how mechanical likes/dislikes effects should be (mild, per pillar 5/6).
- **Gardening property model** — how land is bought/represented (a per-character owned plot doc),
  plot capacity, the growth-CRON cost on M0 (bulk-tick like resource-regen), season length on
  the game clock.
- **Spoilage/freshness** — do perishables decay in the pack/stash over real time (a CRON sweep),
  or is freshness just a snapshot at cook time? Simpler = snapshot; realistic = decay.
- **Balance vs combat** — professions must give non-combat players real progression (rep,
  currency, titles, quality goods) without becoming the strictly-best XP farm; ties to skills.md's
  "only meaningful uses count" and the points economy.

---

## Expansion ideas & risks

**Risks:**
- **Misidentification can read as punishment instead of a fun gamble if it's ever a total
  blackout.** A brand-new forager who gets zero information ("an unidentified something") on
  every pick will bounce off the system fast. Mitigation already implied by the design (generic
  per-family descriptors) but worth stating explicitly: **always** show at least the coarse
  category (a mushroom looks like a mushroom, never "an object") even at 0 skill — the mystery
  should be *which* mushroom, never *that* it's a mushroom.
- **Gardening is the heaviest new infrastructure ask for arguably the lowest engagement payoff**
  on an async ~10-person server (flagged in the original review) — a growth-CRON + property model
  is real build cost; recommend it stays last in build order (already reflected in this file's
  Implementation section) and gets re-evaluated once foraging/fishing prove the profession loop
  is fun at all.
- **Cooking's ingredient-composition math is easy to over-scope.** Six flavor axes + three texture
  + hidden traits + per-eater likes/dislikes is a lot of moving parts for a first build; risk of
  spending significant design/authoring time on a system whose *player-facing* payoff (a stat
  buff + some flavor text) doesn't obviously justify the depth. Recommend shipping with 2–3 axes
  and expanding only if it turns out to matter in play (this file's Open questions already flags
  the axis count as undecided — treat "start small" as the default answer).

**Expansion ideas:**
- **Seasonal/weather-gated ingredient availability** — a rare mushroom only foragable in autumn
  fog (reusing the game clock + weather system, world-travel.md) gives professions a reason to
  revisit locations across real time, which fits the "come back whenever" async design better
  than a static always-available table.
- **A shared "gathering" XP/skill-use consumer built once, reused three times** — foraging,
  fishing, and gardening's harvest step are mechanically identical (spend AP → check → yield
  instance); build the shared reducer once (`game/activity/gather.ts`-shaped) and each profession
  is a data catalog difference, not three separate implementations.
- **A cooking "signature dish" per character** — once a player finds a well-liked recipe, letting
  them name/save it as a personal specialty (cosmetic only) is a cheap identity hook that costs
  nothing mechanically but gives professions the same "this is MY thing" appeal combat styles get.
