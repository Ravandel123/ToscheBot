# Factions — implementation

What exists in `src/` today for the rules in [factions.md](../factions.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

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
