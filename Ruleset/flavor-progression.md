# Flavor & Progression — deed traits, Stress→Madness, texture

See [README.md](README.md) for the legend. "Progression" here means **who a character is
becoming as a person** (their deeds, their mental state) — not skill growth, which is
skills.md's topic.

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

### Stress → Madness ✅ direction *(was P-flavor)*
Inspired by Darkest Dungeon crossed with WHFRP's Madness track:
- **Stress** (a 0–100 meter, 🟡) rises from harrowing experience: getting Downed, watching an
  ally fall, Fear (a canid's Howl, an ambush, something genuinely horrifying), critical
  failures, grim places (the Northern Wastes, a battlefield), prolonged hardship (cold, no
  rest). Resisted by Willpower.
- **Thresholds → Afflictions.** Past a high mark, a character takes a temporary quirk that
  bites — Paranoid, Fearful, Hopeless, Abusive. Rarely the roll breaks the *other* way into a
  **Resolve/Virtue** — a heroic surge. That up-or-down gamble is the Darkest Dungeon spark that
  makes the system tense rather than just punishing.
- **Overflow → Madness.** Maxing the Stress meter grants a Madness point; these accrue into
  longer-term **Disorders** (phobias, compulsions) that linger, color roleplay, and need real
  in-fiction treatment — the setting's lasting mental scars.
- **Recovery.** Rest and comfort in town relieve it: the tavern (drink, socialize, play
  *Mearog* — the canon dice game), a bunk, a Healer, time. Talents like `Resolute`/`Stout
  Heart` (skills.md) should blunt the gain. This is what gives the tavern location real
  mechanical purpose, not just flavor text.
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
threshold yet** — no dialogue branches, no titles, no trait-locked talents, and Stress doesn't
exist yet to have a synergy with.

### Stress, Madness, and the texture menu — ⬜ entirely unbuilt
No `Stress` field, no Afflictions/Disorders, no reputation/scars/cold/vice/hunger/morale
system exists in the data model or the code. This whole section of the Ruleset above is pure
design intent, carried over unchanged from the original design docs.

**One head start:** `src/lexicon.ts` already exports `AFFLICTIONS` and `VIRTUES` word lists
(used today by the fun commands `reactions.ts`/`resolve.ts` for mood/8-ball flavor) — general
vocabulary, not RPG-specific, but plausibly reusable as a starting point for Affliction/Virtue
flavor text once Stress→Madness is actually built, instead of authoring a fresh list from
scratch.

---

## Open questions

- **Stress→Madness as v1-or-soon** — confirm this ships before or alongside combat, since it's
  meant to be a headline "feel" pillar, not an afterthought bolted on later.
- **Texture-menu picks** — which 2–3 of the six listed systems are worth building first (the
  owner's call); reputation is flagged as the most on-theme given the setting's racial tension.
- **Trait list size & delta size** — confirmed direction is 6–10 meters with gentle deltas; the
  six shipped traits fit that, but whether more should be added (or these renamed/rebalanced)
  is still open once trait-gated content is actually authored.
- **Trait-gated content** — the dialogue/quest/title/talent gating that's the whole *point* of
  deed traits doesn't exist yet; traits currently only accrue, they don't unlock anything
  except the one `minTraits` condition example.
