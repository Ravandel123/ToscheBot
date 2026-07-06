# Images — optional art for events, places & characters

See [README.md](README.md) for the legend. This is a **presentation** topic (how the game
*looks*), not a mechanic — nothing here changes a roll or an outcome. It exists so that when
art is added it drops into a system that already expects it, and so the game never breaks when
art is **absent**.

---

## Reference (decided data & math)

- **Images are OPTIONAL, everywhere.** Every image is a garnish on top of the text that already
  carries the meaning (an embed still reads correctly with no picture). The code must **tolerate
  a missing image** — no crash, no broken-link, no empty embed: it silently falls back to
  text-only. (Owner's rule.)
- **What gets art:** *most* **events**, **places** (locations), and **characters** (player
  characters, NPCs, Spire champions). Not everything needs it; coverage is best-effort content.
- **Places have VARIATIONS, selected by world state**, not one fixed picture:
  - **weather** (the location's current weather spell — world-travel.md/D31),
  - **time of day / night vs day** (the game clock — world-travel.md/D31),
  - room to add more axes later (season, running event, danger tier).
- **Selection is best-effort with graceful degradation:** pick the most specific variant that
  exists (place + weather + time), fall back to a less specific one (place + time → place →
  nothing). A missing specific variant is normal, never an error.
- **Ids, not filenames, in the DB** (D10): a stored doc references content by stable slug; the
  actual image (URL/attachment/file) is resolved from a code-side catalog at render time, so art
  can be re-pointed or added without touching stored data.
- **Already present today:** a player character carries an optional `identity.avatarUrl` (shown
  as an embed thumbnail, blank = none) — the first, working instance of "optional image + text
  fallback". The rest (place/event/NPC/champion art + variation selection) is ⬜ not built.

---

## Ruleset

### Optional, always ✅ direction (owner)
The owner's explicit rule: art is **added over time**, so the game must be fully playable with
**zero** images and get progressively richer as pictures are dropped in — never blocked waiting
for an artist. Concretely this means: every place/event/character render is written **text-first**,
and the image is an *addition* the renderer includes **only if it resolves**. A missing image is
the expected default, handled the same way an empty optional field is (like `avatarUrl` already
is on the character sheet), not an exceptional case that logs or breaks layout.

### Places vary with the world ✅ direction (owner)
A location is not one static picture. The same plaza looks different in rain vs sun, at night vs
midday — and the game already tracks both: D31 gives each location a current **weather spell** and
a **game clock** (world-travel.md). So a place's image is chosen from a small set of **variants
keyed on that world state**, picking the most specific one that exists and degrading gracefully
when it doesn't. This makes the world feel alive *reusing state the game already computes* — no
new tracking, just art keyed on the weather/time it already knows. The axis set is open-ended
(season, active event, danger tier could all key variants later) but weather + time-of-day is the
starting pair the owner named.

### Why a code-side catalog, not filenames in the DB (D10)
Following the project's content-vs-state split: the DB stores only *which* place/event/character
(a stable id it already stores), never *which file*. The mapping id → image (and id + weather +
time → variant) lives in a code catalog resolved at render time. Adding art or re-pointing a
broken link is then a catalog edit shipped with a deploy — no migration, and a stored doc from
before the art existed renders identically (just text) until the catalog gains an entry.

---

## Implementation

⬜ **Mostly not built.** What exists:
- `Character.identity.avatarUrl` — an optional per-character image URL, rendered as an embed
  thumbnail on `/character view` with a clean blank fallback (character.md). This is the pattern
  every other image should copy: optional field → include only if present → text stands alone.

What's missing (⬜): an **image catalog** (id → image / id + world-state → variant), a
**resolver** (`imageFor(place, worldContext)` picking the most specific existing variant), the
render wiring in the location hub (`_hubView`), event lines, NPC/champion cards, and the actual
art assets + a decision on **how images are hosted** (see Open questions). The world state the
place-variant selector needs — current weather + time of day — is already available
(`locationStateService` + `world/time.ts`, D31), so the selector is a pure function over a
`WorldContext` the hub already builds.

---

## Open questions

- **Hosting / delivery** — how does an image actually reach Discord? Options: (a) **remote URLs**
  in the catalog (like `avatarUrl` today — simplest, but depends on an external host staying up);
  (b) **repo-committed asset files** uploaded as message **attachments** (self-contained, versioned
  with the code, but grows the repo and re-uploads bytes each send); (c) a hybrid (URLs for large
  art, small attachments for icons). Undecided — affects the catalog shape (`url` vs file path).
- **Embed image vs thumbnail** — a place probably wants a large `setImage`, a character a small
  `setThumbnail`; is that per content-type fixed, or a catalog field?
- **Variant key shape** — is the place-variant lookup a structured key (`{weather, timeOfDay}`) or
  a flat composed slug (`plaza__rain__night`)? And the fallback order when a specific variant is
  missing (weather+time → time → base → none) — confirm the precedence.
- **Per-character art for NPCs/champions** — Spire champions (D37/combat.md) and NPCs (npcs.md,
  `ownerId:null`) have no `avatarUrl` field; do they reuse the same field, or resolve art from a
  code catalog by their content id (they're code content, not player-authored)?
- **How many axes are worth it** — weather + day/night is the owner's ask; season/event/danger are
  tempting but each multiplies the art an artist must produce. Cap the axes to what art actually
  exists for, so the matrix never demands pictures nobody will draw.

---

## Expansion ideas & risks

**Risks:**
- **Art matrix explosion.** Every variation axis *multiplies* the pictures needed (5 places × 4
  weathers × 2 times = 40 images). The graceful-fallback rule is the mitigation — most cells can
  stay empty and degrade to a base image — but the catalog should make "just one base image per
  place" the easy default and variants the opt-in, so coverage can grow one cell at a time.
- **External-URL rot.** If art is remote URLs (option a), a host going down silently blanks images
  server-wide. The optional-with-fallback rule means the game still *works*, but a periodic
  link-check (or committing assets, option b) avoids a slow decay of the art.

**Expansion ideas:**
- **Reuse the variant selector for ambient flavor**, not just static art: the same
  weather/time-keyed lookup could pick a matching *flavor line* or embed color, so a rainy-night
  plaza reads different in words even before any picture exists — art and prose sharing one
  world-state key.
- **Event art as a one-shot spectacle** — a rare location event (world-travel.md) firing with a
  dedicated image makes it feel like an occasion; cheap payoff reusing the event system already
  built.
