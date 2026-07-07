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
- **COMPOSITING (layered images) is a distinct, planned capability** (owner's ask): beyond picking
  *one* picture, the bot must be able to **stack images** — draw overlays on a base at **(x, y)
  coordinates** and upload the result as one attachment. The named example: a **map** base with an
  **X / marker** placed at a character's current coordinates; the owner plans much wider use (party
  tokens on a map, weather/status overlays on a portrait, damage pips on a body diagram, an equipped
  item layered on a paper-doll). Same optional-with-fallback rule: if compositing isn't available or
  a layer is missing, degrade to the base image (or text). ⬜ Not built — see Ruleset §Compositing.
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

### Compositing — layered images & coordinate markers ✅ direction (owner) / ⬜ built
Selection (above) picks *one* finished picture. **Compositing** builds a new picture at render
time by stacking layers, so the image can show **live game state a static asset never could**.
The owner's driving example: a **map** with an **X marking where a character is**, computed from
the character's location — the marker's (x, y) comes from data, not from a pre-drawn file.

The framework (design):
- **A layer stack.** A composite is a **base layer** (a map, a portrait, a body silhouette) plus an
  ordered list of **overlays**, each an image (or generated shape/text) placed at a coordinate with
  a size/anchor/rotation/opacity. Rendered top-to-bottom into one raster, uploaded as a single
  Discord **attachment** (`AttachmentBuilder`), then referenced by the embed like any image.
- **A named coordinate model, not raw pixels.** Overlay positions are authored against the base's
  own coordinate space (ideally **named anchor points** baked into the base's catalog entry — e.g. a
  map lists `locations: { plaza: {x,y}, jetty: {x,y}, … }`), so a character at `plaza` resolves to
  that anchor. Raw pixel (x, y) is the fallback for free placement (a token dropped anywhere). This
  keeps content authoring in *game* terms ("at the plaza") and survives an art re-draw (re-map the
  anchors once, every marker follows) — the D10 discipline applied to positions, not just files.
- **A pure `composite(spec) → image` seam.** One function takes a declarative spec
  (`{ base, layers: [{ image|marker, at, size?, … }] }`) and returns a buffer; the game code builds
  the spec from state (where everyone is, what's equipped) and never touches pixels directly. The
  spec is testable without rendering (assert the right layers at the right anchors); the actual
  raster step is the only impure part.
- **Optional & cached.** Compositing needs a rendering lib (Open questions) that may be absent on the
  host — so it degrades to the base image (or text) if unavailable, per the always-optional rule.
  Because a composite is deterministic from its spec, identical specs (same map + same positions)
  can be **cached** (keyed on a spec hash) to avoid re-rendering every `/play`.

This is the one image topic that is a *capability*, not just art delivery: it turns images into a
**readout of state** (a live map, a marked body, a paper-doll), which is why the owner flags it as
needed infrastructure rather than a nice-to-have garnish.

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

Also ⬜: the **compositing framework** (§Compositing) — a rendering dependency (Open questions), a
pure `composite(spec)` seam + a declarative `CompositeSpec` type, a per-base **anchor catalog**
(named coordinates, e.g. a map's location points), and the first consumer (a location map with a
"you are here" marker off `Character.locationId`). None of the current image surface needs a
rendering lib; compositing is the first piece that does, so it can be added independently later
without touching the selection/variant work above.

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
- **Compositing rendering library** (§Compositing) — which dependency draws the layered image?
  Candidates: **`@napi-rs/canvas`** (fast, prebuilt native binaries — no system Cairo, the usual
  win on managed hosts), **`sharp`** (libvips, great for compositing/resize, also prebuilt), or
  **`jimp`** (pure-JS, zero native deps — slowest but *guaranteed* to run anywhere, the safest
  first pick given Sparkedhost's constraints and the no-build-step tsx setup). **Verify the host
  runs the chosen native module before committing** (the same "smoke-test before relying on it"
  discipline as the `bot.js` tsx shim). Pure-JS `jimp` is the low-risk default; swap up if it's
  too slow. This also decides whether the `composite()` seam is sync or async and how heavy caching
  needs to be.
- **Coordinate authoring** (§Compositing) — named anchors baked into each base's catalog entry
  (authoring in game terms, survives art re-draws) vs raw pixel coordinates (free placement). Likely
  both (anchors for known points like locations, raw for dropped tokens); confirm the `CompositeSpec`
  shape and whether coordinates are absolute px or normalized 0–1 (resolution-independent).

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
