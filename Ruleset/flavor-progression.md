# Flavor & Progression — deed traits, Stress→insanity, texture

See [README.md](README.md) for the legend. "Progression" here means **who a character is
becoming as a person** (their deeds, their mental state) — not skill growth, which is
skills.md's topic.

---

## Reference (decided data & math)

**Deed traits** ✅ (real content) — six independent rising meters, clamped `≥0`, start 0:
`courage · cowardice · mercy · cruelty · honor · empathy`. Not one alignment axis (brave AND
cruel is allowed). Moved by `applyTraitDeltas` (atomic clamped delta). Keep the list **tight
(6–10)** and deltas **gentle** (no single act maxes a meter). Shown on `/character view` when
nonzero.

**What deed traits gate** (⬜ except one) — dialogue options (conversations.md), quest branches,
NPC reactions (npcs.md), **titles**, trait-locked **talents** (skills.md), and what *stresses*
the character (below). Today the only consumer is the `minTraits` condition (world-travel.md).

**Stress → insanity** ✅ direction (🟡 numbers, R21) — a **Stress bar 0–100**, rises from
harrowing experience (getting Downed, an ally falling, Fear, critical failures, grim places,
cold/no-rest), resisted by **Willpower**. Lowered by **chilling/comfort activities** (tavern,
rest, Healer). Thresholds → temporary **Afflictions** (rarely a **Virtue** instead — the up/down
gamble). **Maxing Stress → +1 insanity point**; gaining one **risks a lasting mental
disadvantage** (a Disorder). Insanity points are removed only by **special treatment**. Feeds
character.md's `mentalState`.

**Likes/dislikes** (character.md R20) — the character's own tastes (food/music/race/faction);
distinct from deed traits (who you're becoming) and faction reputation (how others see you).

**Texture menu** (⬜ pick a few) — faction reputation (→ factions.md), scars/injuries (→
character.md `physicalState`), cold/weather, vice/addiction (→ `mentalState`), hunger/rest, combat
morale (Broken — combat.md).

---

## Ruleset

### Why this exists ✅ R9
The grim, grounded BtWD tone — "an anthropomorphic Game of Thrones" — wants attrition systems
a lean game would cut. These are meant to be a **feature**, not scope creep: they add
immersion, tension and fun on top of the mechanical loop. The one hard rule (README.md's
pillar 5/6): every one of these must always stay **auto-managed for casuals** — a texture
system that becomes a chore to track breaks the simple/deep contract. If it can't be ignored
by a casual player, it isn't done.

### Deed traits — who you're becoming ✅ direction *(was P-traits)*
Beyond skills, a character should grow **personality traits by deed** — independent rising
meters like Courage/Cowardice, Cruelty/Mercy, Empathy, Honor. Not one good↔evil slider: you can
be brave *and* cruel at once, because people are complicated. Actions and choices carry trait
deltas (spare a foe → +Mercy/+Empathy; execute a prisoner → +Cruelty; flee → +Cowardice; hold
against fear → +Courage; keep your word → +Honor). Thresholds are meant to **gate content**:
dialogue options, quest branches, NPC reactions, titles, and eventually a few trait-locked
talents — only a sufficiently Cruel character can pick a menacing dialogue line; a Merciful one
unlocks a compassionate resolution.

**Synergy with Stress (below):** a character's traits should shape *what stresses them* — a
Merciful character takes Stress from killing, a Ruthless one shrugs it off or even gains
Resolve from it. This is meant to be one coherent psychology, not two unrelated meters.
Distinct from **faction reputation** (that's *public* standing; traits are *inner* — a
character can be secretly cruel with a clean public face).

**Two layers:** casual — invisible bookkeeping; dialogue options simply light up (`[Cruel]`,
`[Brave]`) and the bot narrates the legend forming. Deep — watch the actual meters, roleplay
toward thresholds, chase trait-gated talents/titles.

**Pushback, stated as a constraint on this system specifically:** keep the trait list **tight**
(6–10 meters) and deltas **gentle** — one act should never max a meter. Keep it *mostly*
narrative; a little mechanical weight is fine (Courage resisting Fear/Stress, Cruelty
unsettling a foe) but this must not become a stat-buff farm.

### Stress → insanity ✅ direction *(was P-flavor; owner's "stress bar" + "insanity points")*
Inspired by Darkest Dungeon crossed with WHFRP's Madness track. (The owner's TODO calls the
overflow "insanity points"; that's the term used here — formerly "Madness points".)
- **Stress** (a 0–100 meter, 🟡) rises from harrowing experience: getting Downed, watching an
  ally fall, Fear (a canid's Howl, an ambush, something genuinely horrifying), critical
  failures, grim places (the Northern Wastes, a battlefield), prolonged hardship (cold, no
  rest). Resisted by Willpower.
- **Lowered by chilling/comfort activities** (the owner's ask). This is the tavern's whole
  mechanical purpose (drink, socialize, play *Mearog* — the canon dice game), plus a bunk, a
  Healer, and simply time — the calm counterpart to the grind, and a real reason to come home to
  Deltrada between expeditions.
- **Thresholds → Afflictions.** Past a high mark, a character takes a temporary quirk that
  bites — Paranoid, Fearful, Hopeless, Abusive. Rarely the roll breaks the *other* way into a
  **Resolve/Virtue** — a heroic surge. That up-or-down gamble is the Darkest Dungeon spark that
  makes the system tense rather than just punishing.
- **Overflow → insanity points.** Maxing the Stress meter grants an **insanity point**, and
  gaining one carries a **chance of a lasting mental disadvantage** (the owner's framing) — a
  **Disorder** (phobia, compulsion, addiction — see character.md's `mentalState`) that lingers,
  colors roleplay, and doesn't just wear off. Insanity points are removed **only by special
  treatment** (a Healer, a shrine, a quest — not by resting it off), so they're the setting's
  real, earned mental scars, not another regenerating bar.
- **Traits shape what stresses you** (the synergy below): a Merciful character takes Stress from
  killing; a Cruel one shrugs it off. One coherent psychology — Stress, deed traits and
  `mentalState` are three views of the same inner life, not three unrelated meters.
- **Recovery / mitigation.** Talents like `Resolute`/`Stout Heart` (skills.md) blunt the gain;
  Willpower resists it. Afflictions and Disorders feed **character.md's `mentalState`** list, so
  the character sheet shows *what's wrong* and the bot narrates it — auto-managed for casuals.
- **Two layers.** Casual: a stress bar the bot shows and auto-manages — it warns the player,
  suggests "rest at the tavern," and narrates Afflictions as they hit, click-through style.
  Deep: actively manage/treat Afflictions, cure Disorders, build stress-resistant characters,
  chase Virtues.

### The wider texture menu ⬜ pick what's worth building
A menu of further attrition/immersion systems, explicitly **not all commitments** — pick the
top few worth building, don't build all of them reflexively:
- **Faction standing / reputation** — how each kingdom/faction treats a character (an ermehn is
  hunted in Aisling; a canid is distrusted in the Wastes). Very on-theme — racial tension is
  the setting's core conflict.
- **Scars & lingering injuries** — going Down (combat.md) can leave a small permanent debuff +
  a story detail (a limp, a notched ear).
- **Cold & weather (survival-lite)** — the Wastes bite; ties into a `Cold-Hardened` racial
  trait (character.md) mattering mechanically, not just flavor-wise.
- **Vice & addiction** — the tavern relieves Stress, but the bottle can hook a character who
  leans on it too often.
- **Hunger / rest** — light camp-needs on long expeditions.
- **Morale & Fear in combat** — a Broken condition (combat.md); a canid's Howl or general
  horror drives it.

**Rule of thumb, repeated because it's easy to violate while adding "just one more" texture
system:** each one must be opt-in-deep **and** auto-managed-casual, or it doesn't ship.

---

## Implementation

### Deed traits — `game/data/traits.ts` ✅ shape, real content
Six traits ship (not a placeholder set — this is the actual launch list): `courage,
cowardice, mercy, cruelty, honor, empathy`. Independent rising meters, clamped `>= 0`, starting
at 0 — courage and cowardice can rise together, since traits track lived deeds, not a single
alignment axis. Accrued via `characterService.applyTraitDeltas` (an atomic clamped delta) from
world-travel.md's travel-encounter outcomes (the drowning-stranger encounter is the only
content that moves them today). Shown on `/character view` whenever nonzero.

The **only** consumer so far is world-travel.md's condition language: `minTraits` (e.g. a
plaza NPC greeting only appears once `empathy >= 1`). **Nothing else gates on a trait
threshold yet** — but the *designed* consumers now exist on paper: **dialogue options**
(conversations.md R14, both gating and awarding traits), **trait-locked talents** (skills.md R13's
talent requirement list), **titles** (backlog), and the **Stress synergy** above. These are the
payoff that makes tracking deed traits worthwhile; deed traits are the owner's "personality
traits (mercy, cruelty etc.)" — already the launch list, not a placeholder.

### Stress, insanity, and the texture menu — ⬜ entirely unbuilt
No `Stress` field, no Afflictions/Disorders, no reputation/scars/cold/vice/hunger/morale
system exists in the data model or the code. This whole section of the Ruleset above is pure
design intent, carried over unchanged from the original design docs.

**One head start:** `src/grammar/vocabulary/adjectives.ts` already carries `affliction` and
`virtue` word pools (used today by the fun commands `reactions.ts`/`resolve.ts` for
mood/8-ball flavor) — general vocabulary, not RPG-specific, but plausibly reusable as a
starting point for Affliction/Virtue flavor text once Stress→Madness is actually built,
instead of authoring a fresh list from scratch. The D49 sentence engine
(`grammar/sentence.ts`) is likewise a ready seam for narrated affliction/mood lines.

---

## Open questions

- **Stress→insanity numbers** *(R21)* — the *model* is confirmed (Stress bar, chilling lowers it,
  overflow → insanity points, gaining one risks a Disorder, treatment-only removal). Open: the
  0–100 thresholds, Affliction/Virtue tables, the disadvantage-on-gain chance, what counts as
  "special treatment", and whether it ships before/with combat (it's meant to be a headline
  "feel" pillar, not bolted on later).
- **Texture-menu picks** — reputation is now **committed** (factions.md R15); scars/injuries and
  vice/addiction now have a home in character.md's `physicalState`/`mentalState` (R20). Still
  open: which of cold/weather, hunger/rest, combat morale are worth building first.
- **Likes/dislikes & mental/physical state ownership** — these live on `Character` (character.md
  R20) but their *sources and effects* are here (Stress → a Disorder in `mentalState`; cooking a
  liked dish → Stress relief, professions.md). Confirm the split so neither file drifts.
- **Trait list size & delta size** — confirmed direction is 6–10 meters with gentle deltas; the
  six shipped traits fit that, but whether more should be added (or these renamed/rebalanced)
  is still open once trait-gated content is actually authored.
- **Trait-gated content** — the dialogue/quest/title/talent gating that's the whole *point* of
  deed traits doesn't exist yet; traits currently only accrue, they don't unlock anything
  except the one `minTraits` condition example.

---

## Expansion ideas & risks

**Risks:**
- **Five meters describing "who a character is" can drift into redundancy** (deed traits,
  reputation, Stress/insanity, likes/dislikes, physical/mental state — see README's cross-cutting
  risk). Concretely here: if a Merciful character's Stress-from-killing synergy and a `mentalState`
  Disorder both end up modeling "this character feels bad about violence," that's two systems
  doing the same narrative job. Keep the boundary crisp: **traits** = what you've done, **Stress/
  insanity** = current mental wear from what's happened *to* you, **mentalState** = the lasting
  scars that wear leaves behind. A trait shaping Stress *sensitivity* (the synergy above) is fine;
  a trait directly writing to `mentalState` would blur the line.
- **Insanity points removable "only by special treatment" needs that treatment to actually exist**
  before this ships, or a character who overflows Stress early is stuck with a permanent
  disadvantage with no in-game recourse — a real fun-negative risk for an unlucky early session.
  Recommend: don't ship Stress overflow before at least one treatment path (a Healer visit, a
  tavern ritual) is buildable, even if crude.

**Expansion ideas:**
- **Virtues as a genuine build path, not just a rare upside roll** — a character who consistently
  resists Stress well (high Willpower, Resolute talent) could lean into a "Stalwart" identity
  where Virtue triggers happen often enough to be a flavor signature, not just a rare surprise —
  gives Willpower-focused builds a payoff beyond raw resistance.
- **A once-per-season "reflection" ritual** — a tavern/Healer activity that doesn't just relieve
  Stress but lets a player *choose* to nudge one trait slightly (reinforcing who they're playing,
  within the gentle-delta budget) — a small narrative-agency lever distinct from passive accrual.
- **Titles as the trait/reputation payoff, built once, reused everywhere** — a single small
  "titles" system (character.md/factions.md both want one) could read trait thresholds, faction
  rep, and Spire records through one shared mechanism rather than three bespoke unlock paths.
