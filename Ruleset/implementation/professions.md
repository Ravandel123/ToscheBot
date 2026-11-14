# Professions — implementation

What exists in `src/` today for the rules in [professions.md](../professions.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

✅ **Foraging v1 is LIVE (S1, 2026-07-10)** — the shared gather engine + identification, built
exactly as the R16 skeleton; fishing (next: S2) reuses everything but the identify sweep.

- **The gather engine** (`game/professions/gather.ts`, pure): a gather is a **short action**
  (D5 rule 1) under the character lock, never an ActivitySession. Flow: spend
  `FORAGE_AP_COST = 1` 🟡 → d100 check (node's `skillNode` vs its `difficulty`, race
  affinities apply, trains the path win or lose) → on success **quantity = 1 + SL/2, cap 4** 🟡
  → per unit: weighted table pick + **`qualityFromCheck`** (the shared surplus→quality helper
  smithing will reuse: SL − 2..+1 jitter into today's 4 tiers) → grant to pack
  (encumbrance-checked; overflow is narrated and lost) → `creditSkillUse` (D40 difficulty
  weight) → chronicle **only recognized** noteworthy/pristine finds.
- **Resource nodes** (`game/data/resourceNodes.ts` + `LocationDefinition.resourceNodes`):
  riverbank (`riverbank_greens`, lutren ×1.25) and the new **Tanglewood** location
  (`woodland_undergrowth`, tamian ×1.25), both difficulty +20 🟡; ids test-validated like graph
  edges, and the `forage` hub action's locations are test-locked to where a foraging node exists.
- **Identification** (`game/professions/identify.ts` + instance fields
  `identified/apparentItemId/descriptorId` — optional ⇒ zero migration, and they survive
  pack↔stash transfers): ONE identify roll sweeps the whole haul vs each find's own target
  (`identify_forage` leaf + per-item `identifyModifier`); a miss shows a per-family descriptor
  (`game/data/foragables.ts` pools — always at least the coarse family), and 40% 🟡 of misses
  **plausibly mislabel** (same family, shared look preferred). **Examine** on the `/inventory`
  item card re-checks at a uniform `EXAMINE_AP_COST = 1` 🟡 — uniform so neither the button,
  the AP charge nor the reply can leak which labels are wrong: every outcome reads equally
  confident, rolls are never shown, truth is sticky (an identified find can't be talked back
  into doubt), and a successful identify merges the find into its identified stack.
- **Display is belief**: name/value/description render the *perceived* item (descriptor when
  unknown — worth **?**/0 until known; the apparent item when mislabeled, quality prefix and
  all); weight always reads the REAL item so panels can't contradict and betray a mislabel.
  Forage quality names use their own row (Wilted/—/Choice/Pristine, the first R23 name row).
- **Sim-verified (D42), all numbers 🟡**: fresh forager (attr 27) ≈ 36% success, 0.55
  items/AP, 81% common / 8% fine, ~31% of finds recognized (woodland ~20%); skilled (20 pts)
  ≈ 56%, 1.1 items/AP, 62% recognized; masterwork 0% below ~50 effective → ~5% at 76 → ~21%
  at the 95 cap. Growth (real `creditUse`): foraging hits 5 pts in ~29 gathers, 10 in ~180,
  20 in ~880 (the sweep also banks the root, so the profession paces ~a third faster than a
  bare root). Certain-ID cost via Examine: stingweed ~2.8 AP at 0 skill; ashgill ~17 AP.

Still ⬜ per the original order:
2. **Fishing** (S2) — port the old tables onto `resourceNodes` + rod/lure gear modifiers.
3. **Cooking** — the flavor engine + dynamic meal composition + likes/dislikes hook;
   **reveal-on-consumption** for misidentified edibles lands here.
4. **Gardening** — needs a property/plot model + a growth CRON; heaviest new infra, do last.

Also still ⬜: NPC identify-for-a-fee (an apothecary — npcs.md; the Examine action is the seam),
foraging's other leaves (Mushrooms/Herbs/Fruit & Forage) as per-family content, ingredient
variants (the apple example).
