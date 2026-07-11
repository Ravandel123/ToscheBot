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
  a layer is missing, degrade to the base image (or text). 🟡 The rendering seam is built and
  verified on Sparkedhost (D46) — see Ruleset §Compositing; no art catalog or consumer yet.
- **Already present today:** a player character carries an optional `identity.avatarUrl` (shown
  as an embed thumbnail, blank = none) — the first, working instance of "optional image + text
  fallback". The compositing *seam* also exists (D46); place/event/NPC/champion art, variation
  selection, and every actual compositing consumer are still ⬜ not built.

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

### Compositing — layered images & coordinate markers ✅ direction (owner) / 🟡 seam built (D46)
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
- **A pure `composite(spec) → image` seam. 🟡 Built (D46/D47):** `game/images/composite.ts` on
  `@napi-rs/canvas`. `composite({ base, layers })` takes a base (image path/URL/bytes, or a blank
  canvas `{width, height, color?}`) and a `CompositeLayer[]` (`image` with
  width/height/opacity/rotate/center-anchor, `marker`, `text`, `rect`) and returns a flattened
  PNG buffer; the game code builds the spec from state and never touches pixels directly.
  Discord-agnostic — a caller wraps the buffer in an `AttachmentBuilder`. The named anchor table
  lives in the asset catalog (`assets.ts`, D47) — still empty of entries, but the mechanism is
  in place; raw pixel `{x,y}` remains the free-placement fallback, exactly as designed.
- **Optional & cached.** A thrown error from `composite()` (rendering lib unavailable, bad
  source) must be caught by the caller and degrade to the base image (or text), per the
  always-optional rule — `composite()` itself does not swallow errors. **Verified working on
  Sparkedhost**, not just locally/CI, via the owner-only `h!imagetest` smoke-test command (renders
  a self-contained fixture, no art needed — re-run after any host change). Caching is NOT built:
  because a composite is deterministic from its spec, identical specs (same map + same positions)
  *could* be cached (keyed on a spec hash) to avoid re-rendering every `/play` — worth adding once
  a real consumer's render cost is measured, not before.

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

🟡 **Partially built.** What exists:
- `Character.identity.avatarUrl` — an optional per-character image URL, rendered as an embed
  thumbnail on `/character view` with a clean blank fallback (character.md). This is the pattern
  every other image should copy: optional field → include only if present → text stands alone.
- **The compositing seam (D46, extended by D47)** — `game/images/composite.ts`:
  `composite(spec) → Buffer` on `@napi-rs/canvas`. The spec is `{ base, layers }` where base is
  an image (path/URL/bytes) **or a blank canvas** `{width, height, color?}` (a scene needs zero
  art), and layers are `image` (with optional width/height/opacity/**rotate**/**center anchor**),
  `marker` (filled circle + optional outline), `text` (bundled font, size/color/bold/align) and
  `rect` (rounded panels/overlays). Discord-agnostic (returns a raw PNG buffer; a caller wraps it
  in an `AttachmentBuilder`). **Verified working on Sparkedhost** via the owner-only
  **`h!imagetest`** — re-run it after any host change to re-confirm the native dependency loads.
- **Bundled fonts (D47)** — `assets/fonts/` commits DejaVu Sans (+Bold, free license) and
  `game/images/fonts.ts` auto-registers it on first use: text renders identically on every host,
  and a font-less container (which would otherwise draw text as *nothing*) is covered.
  `h!imagetest` reports the font-family count — 0 means drop a `.ttf` into `assets/fonts/`.
- **Card & chip renderers (D47, the gambling-salon toolkit)** — `game/images/cards.ts` /
  `chips.ts` DRAW playing cards (52 faces + a lattice back, vector suit shapes, cached per size)
  and poker chips (labelled, uncached) programmatically: the future salon is fully playable with
  zero art, and real card art can replace the drawings via the asset catalog later.
  `renderHand()` spreads a mixed face-up/face-down hand into one transparent PNG. Game rules
  (decks, shuffling, stakes) deliberately do NOT live here — rendering only.
- **The asset catalog (D47)** — `game/images/assets.ts`: `IMAGE_ASSETS` maps stable ids to
  `assets/images/` paths **plus named anchor points** (the coordinate model above — a map's
  `locations: {plaza: {x,y}}`); `imageAsset(id)` degrades to null on unknown/missing (never
  throws), and a test validates every entry's file exists. The catalog ships empty — the first
  real entry is the location map.
- **Looping animation (D48)** — `game/images/animate.ts`: `renderGif(frames, opts)` encodes a
  sequence of composite specs into one animated GIF via `@napi-rs/canvas`'s built-in
  `GifEncoder` — a real animation is ONE encoded file, uploaded once, never a rerender+`editReply`
  timer loop (which would fight Discord's edit rate limit). `renderCardSpinGif` is the concrete
  demo (`h!imagetest gif`): a card shrinks to edge-on and swaps face/back at the geometric
  crossing point, not a canned sprite sequence — the same primitive works for any two-sided
  image later (a chip, a marker, a paper-doll layer).

What's missing (⬜): an **image catalog** (id → image / id + world-state → variant), a
**resolver** (`imageFor(place, worldContext)` picking the most specific existing variant), the
render wiring in the location hub (`_hubView`), event lines, NPC/champion cards, and the actual
art assets. The world state the place-variant selector needs — current weather + time of day — is
already available (`locationStateService` + `world/time.ts`, D31), so the selector is a pure
function over a `WorldContext` the hub already builds. Hosting/delivery is now decided (see Open
questions) — repo-committed `assets/images/` for anything a composite draws on.

Also ⬜: the first real consumer — a location map with a "you are here" marker off
`Character.locationId` is the reference target (the anchor mechanism is ready in `assets.ts`;
what's missing is the map art + its catalog entry + the hub wiring). A bordered avatar (border
asset + a player's `avatarUrl`) and a gambling-table render (felt + `renderHand` + chips) are
the same `composite()` call with different specs.

---

## Open questions

- ~~**Hosting / delivery**~~ **Decided (D46, 2026-07-11):** split by *purpose*, not one global
  choice. Anything the bot's own renderer draws layers **ON** (map bases, avatar-frame overlays,
  board/piece art) is **repo-committed** under `assets/images/`, resolved by a code-side catalog
  (id → relative path, D10) and loaded by local path — the render happens inside a request, so it
  must not gain a network dependency for art that ships with the code anyway. Purely-linked,
  non-composited art (a plain `setImage`, no layers) may stay external since Discord fetches it
  directly — prefer **GitHub raw links** (already owned, versioned, free) over a generic host like
  imgur (hotlink throttling / anonymous-upload purges make it unreliable for art a live feature
  depends on). A character's `avatarUrl` (Discord CDN, user-supplied) is the one deliberate
  remote `ImageSource` *inside* a composite (e.g. a border over a player's avatar) — a failed load
  there must be caught by the caller and degrade to the base/no-overlay, never crash the command.
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
- ~~**Compositing rendering library**~~ **Decided (D46): `@napi-rs/canvas`.** Chosen over `sharp`
  (great at image-on-image blending, but no real drawing API for the marker/shape case) and `jimp`
  (pure-JS safety net, but slow and weak at drawing) because it has an actual 2D canvas API
  (arcs/text/shapes, not just compositing) and ships prebuilt native binaries — no system Cairo,
  the historical pain with the older `canvas` package. **Verified on the actual host, not just
  locally/CI**, via `h!imagetest` — confirmed working on Sparkedhost (2026-07-11); re-run it after
  any host change. If a future host can't load it, `jimp` is the documented fallback — the whole
  dependency is isolated behind `composite()`, so swapping libraries touches one file.
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
