# Flavor & Progression — implementation

What exists in `src/` today for the rules in [flavor-progression.md](../flavor-progression.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

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
