# NPCs — implementation

What exists in `src/` today for the rules in [npcs.md](../npcs.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

✅ **Step 1 is LIVE (S2/D44, 2026-07-10)** — the static roster:
- `game/data/npcs.ts` — 7 named NPCs (plaza merchant, tavernkeeper, spire guard, ferryman,
  herb-gatherer, old campaigner, wandering scholar) with archetype (data-only seam: nothing
  reads it at runtime; the shop finds its keeper through `game/data/shops.ts`), home,
  starting gear, and 🟡 starting coins (for the plaza merchant these are replaced by the
  shop's daily stock and till on the first trading day). Content integrity (lengths, carry weight vs racial strength, a merchant anchored at
  the plaza) is test-locked in `npcs.test.ts`.
- `characterService.createNpc` mints an approved `ownerId: null` character under the stable
  `npc-<npcId>` id — never through the wizard/approval flow (D13 vets players, not content);
  `npcDefinition(characterId)` resolves the static half back from the catalog (D10).
- `scripts/seed-npcs.ts` — the idempotent upsert (see Seeding above).
- NPCs already show in `/play` presence with an *(NPC)* tag — zero new runtime code, as
  designed.

Build order, remaining:
2. ⬜ `game/data/npcBehaviors.ts` + `jobs/npcTick.ts` — the hourly brain (start with just
   **movement**, the highest-impact/lowest-risk action), bulk-first & lock-aware per D23.
   **Blocked on the lifecycle decision** (PLAN Decision queue #7); when it lands, also flip
   `npcSeed.ts`'s reseed-repositions-home block (location becomes mutable state).
3. 🟨 Player-facing verbs, in demand order: **trade** ✅ (D60, 2026-11-14: the plaza merchant
   keeps a real stall — his own pack and coins; economy.md. His only behaviour is the daily
   reset of stock and till, the piece the hourly brain in step 2 is meant to replace) →
   **conversation** ✅ (S4/D45, 2026-07-10: every NPC talks via its archetype's `small_talk`
   template or an authored tree — `NpcDefinition.dialogueId`, Marrek's `marrek_tales` is the
   proof piece; conversations.md Implementation. A mid-chat NPC is deliberately NOT session-
   busy) → **teaming** ⬜ (needs the Side-A/B combat engine, combat.md) → autonomous
   professions ⬜ (needs professions.md).
4. ⬜ `disposition` (per-NPC-per-character) — add when teaming/gift content needs it; keep
   bounded (sparse-only from day one).
