# Images — implementation

What exists in `src/` today for the rules in [images.md](../images.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

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
