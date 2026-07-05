# Factions — organizations and reputation

See [README.md](README.md) for the legend and the shared file shape.

A **faction** is an organization or nation a character can stand well or badly with. Per R15,
each character carries a **reputation** value per faction — their *public* standing, distinct
from deed traits (flavor-progression.md — *inner* character) and from likes/dislikes
(character.md — the character's *own* feelings). Reputation gates access, prices, quests,
dialogue (conversations.md) and NPC reactions (npcs.md), and is a natural home for the setting's
core racial-tension conflict (README's "core wound").

---

## Reference (decided data & math)

**Storage** — `Character.reputation: Partial<Record<FactionId, number>>`, **sparse** (absent =
the faction's racial baseline, resolved from code), clamped to a fixed band. Bounded by the
catalog + hot-path-ish ⇒ embedded on the character (D32).

**Reputation tiers** (🟡 band values, integer scale proposed `[-100 … +100]`):

| tier | band | effect sketch |
|---|---|---|
| Hated | −100…−61 | attacked/ejected on sight; shops refuse; some areas barred |
| Hostile | −60…−21 | worse prices, no quests, cold dialogue |
| Neutral | −20…+20 | default; standard prices |
| Friendly | +21…+50 | small discount, minor quests, warmer lines |
| Honored | +51…+80 | good discounts, faction quests, gated dialogue/areas |
| Exalted | +81…+100 | best prices, unique rewards, a title (flavor-progression.md) |

**Faction catalog** (`game/data/factions.ts`, ⬜ not built) — per entry: `id, name, home region,
racialBaselines: Partial<Record<RaceId, number>>, relations: Partial<Record<FactionId, number>>`
(ally/enemy weight for **rep spillover**), optional `currency`, `ranks?`.

**Canon seed factions** (from README's setting; verify specifics against the owner's lore docs):

| faction | region / race | note |
|---|---|---|
| Aisling Crown | canid | militaristic; **hostile baseline to `ermehn`** (canon Ermehn War) |
| Sunsgrove | tamian + lutren | scouts & seafarers |
| Navran | vulpin | cosmopolitan nomads/traders |
| Kishar | felis | scholars |
| Sratha-din | ermehn (stateless) | revived exile resistance; hostile to Aisling |
| Polcan raiders | polcan (stateless) | seaborne raiders |

**Local Deltrada factions** (the actual play surface — the server is Deltrada):
Deltrada Watch (guards), Merchants' Guild, the Sunken Tankard (tavern), a temple/healers, and
the Smackdown Spire's fight circuit. These are where reputation is *earned and spent* day to day;
the six great powers color background and long arcs.

---

## Ruleset

### Reputation is public standing, and it's per character ✅ direction R15
It rises and falls by **deed**: completing a faction's quests, helping/robbing its members,
siding with it in a dialogue (conversations.md), winning/dodging its arena, being caught
smuggling. It's stored per **character** (like currencies and ELO — character.md's Account↔
Character split), because a player's two personas can stand very differently with the Watch.

### Racial baselines seed the setting's conflict ✅ direction
A faction can start a race at a non-neutral baseline: an **ermehn is Hostile in Aisling from
character creation** (canon), a canid is distrusted among the stateless. This makes race a
*social* fact, not just a stat block — and gives immediate, on-theme friction to explore or
overcome. Baselines live in the catalog; a fresh character stores nothing until a deed moves the
needle off baseline.

### Factions relate to each other → rep spillover ✅ direction (numbers 🟡)
Factions carry weighted `relations`. Gaining rep with one **bleeds** rep with its enemies (help
the Watch bust a smuggler → +Watch, −Merchants'-Guild-gray-market) and a little *toward* its
allies. This makes reputation a **web of trade-offs**, not six independent bars you max in
parallel — you can't be Exalted with everyone, which is the point (and mirrors the trait design:
you become *someone specific*).

### What reputation gates ✅ direction
- **Prices** — a Haggle check (economy.md) is *modified by* standing; Hated may mean "no sale."
- **Access** — areas, containers (a faction bank — items-equipment.md), events, arena tiers.
- **Quests & dialogue** — options and whole trees gated by `minRep` (conversations.md).
- **NPC reactions** — greetings, aggression, willingness to team up (npcs.md).
- **Titles** — an Exalted standing can grant a displayed title (flavor-progression.md's
  titles idea), the cheap high-value social reward.

### Ranks within a faction ⬜ direction only
Beyond raw reputation, a character may hold a **rank** in a faction they've joined (Recruit →
… → Officer) unlocking rank-only actions/gear/quests. Rank is *chosen membership* (you enlist),
reputation is *how they feel about you* — you can be Honored by Aisling without being a soldier.
Keep this optional; not v1.

### Two layers ✅ (pillar-6 contract)
- **Casual** — reputation is a colored label on `/character view` and the reason a shop is
  cheap or a guard is cross; the bot narrates it. Never a spreadsheet.
- **Deep** — track the numbers, farm a faction toward a gate, exploit relation-spillover,
  chase a rank/title, run the racial-tension arcs.

---

## Implementation

⬜ **Nothing is built.** Reputation is the first genuinely *new* per-character field this set of
changes adds beyond deed traits. First build:
1. `game/data/factions.ts` — the catalog (ids append-only, D10; test-validated: every
   `relations` target exists, baselines reference real races).
2. `Character.reputation` sparse map + `characterService.applyReputationDeltas` (atomic clamped
   delta, with **relation-spillover** computed from the catalog — one write applies the primary
   delta and the weighted secondary deltas).
3. `game/factions.ts` — pure helpers: `reputationOf(character, factionId)` (stored value or
   racial baseline), `tierOf(value)`, `spilloverDeltas(factionId, delta)`.
4. Consumers, in likely order: conversations.md `minRep` gates + rep-awarding options →
   `/character view` display → shop pricing (economy.md) → NPC reactions (npcs.md).

Reuses the exact atomic-clamped-delta pattern already used for currencies and traits.

---

## Open questions

- **Scale & tier bands** — the `[-100…100]` / six-tier sketch is a proposal; confirm the range
  and each band's concrete effects.
- **How much rep a deed is worth** — gentle like traits (no single act flips a tier), or can a
  dramatic betrayal swing hard? Probably: quests move it meaningfully, incidental acts nudge it.
- **Reputation decay** — does standing drift back toward baseline over time if you stop
  engaging? Simplest v1: no decay. Consider a slow pull for realism later.
- **Rep vs deed traits vs likes/dislikes** — three related but distinct axes; make sure content
  authors (and the `/character view` sheet) keep them legibly separate: *what you've done*
  (traits), *how they see you* (reputation), *what you enjoy* (likes/dislikes).
- **Great powers vs local factions scope for v1** — recommendation: build the **local Deltrada
  factions** first (they're where play happens); the six canon powers can start as
  baseline-only labels and grow content when quests arrive.
- **Ranks/membership** — whether joining a faction (a rank ladder) ships at all in v1, or
  reputation-only is enough to start.

---

## Expansion ideas & risks

**Risks:**
- **Relation-spillover math can snowball or stall.** A naive weighted-spillover implementation
  risks two failure modes: (a) helping one faction repeatedly nukes an ally faction to
  unrecoverable Hated with no path back (griefing your own options), or (b) spillover weights too
  small to ever matter, making the "web of trade-offs" pitch hollow. Needs either a floor (rep
  can't spill below some soft minimum from secondary effects alone, only from direct action) or a
  slow natural pull back toward baseline for spillover-only movement (separate from primary-deed
  movement, which stays permanent).
- **A single-owner content bottleneck** (README's cross-cutting risk) hits this file hardest —
  reputation is only interesting once there's enough content (quests, dialogue, prices) gating on
  it, and all of that is hand-authored. Recommend proving the *mechanism* with a tiny amount of
  content (one local faction, a handful of gates) before authoring the full six-power canon web.

**Expansion ideas:**
- **A visible "standing" summary command** — a small `/reputation` or a tab on `/character view`
  showing all nonzero standings + tier labels, so a deep player can actually plan around the
  spillover web instead of discovering it by surprise.
- **Faction-specific currencies as a rank reward**, not a race reward — ties the shelved regional-
  currency idea (economy.md) to *earned membership* rather than birth, which might be a more
  interesting unlock than the original race-locked framing.
- **Secret standing vs public standing** — a character could maintain a public face with one
  faction while secretly aiding its rival (a double-agent playstyle), if reputation *display* to
  other players/NPCs is separated from the *stored* value revealed only to the character
  themself — pairs naturally with flavor-progression.md's "secretly cruel with a clean public
  face" framing for deed traits.
