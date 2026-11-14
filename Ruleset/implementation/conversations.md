# Conversations — implementation

What exists in `src/` today for the rules in [conversations.md](../conversations.md): which files carry each rule and how far the code gets it. The rules themselves, the
reasons and the open questions live in that file, not here. Status marks: see
[README.md](../README.md). This text was moved out of the rule file unchanged on
2026-11-11, so "above" / "the Ruleset section" in it means the rule file.

---

✅ **Dialogue v1 is LIVE (PLAN S4, D45, 2026-07-10)** — exactly the four-piece build this
section named, template-first:

1. ✅ `game/data/dialogues.ts` — the node/option catalog (D10), **graph-test-validated**
   (`dialogues.test.ts`: every `next` resolves, every node reachable from `start`, rolled
   options declare a `failure` route, hidden options have a gate, `{placeholders}` known).
   Content: **`small_talk`** — ONE reusable template serving every archetype (greeting,
   per-archetype `{work}` function pointer via `WORK_LINES`, a repeatable rumor pool, a
   one-shot `[Persuade]` press for secrets) — plus **`marrek_tales`**, the single authored
   named-NPC tree (Marrek: lore node, persuade check, a `+cruelty` awarding line, a
   `[Courage ≥ 1]` visible-locked gate, a `heard_truth`-unlocked hidden toast `+honor`).
   Assignment: `NpcDefinition.dialogueId` (authored) else `ARCHETYPE_DIALOGUES[archetype]`.
2. ✅ `game/activity/dialogue.ts` — the pure reducer, mirroring `challenge.ts`
   (state-from-blob tolerance, per-option targets precomputed at session start for honest %,
   outcome lines stored in state so repaints are stable, terminal `resolution` derived-then-
   stored for crash-safe completion).
3. ✅ `commands/components/_activities/dialogue.ts` — the handler, registered by type
   `dialogue`; step-guarded `advance` per pick, side writes (traits via `applyTraitDeltas`,
   speechcraft via `creditSkillUse`, AP) ride the guard win; farewell finalize re-entry.
4. ✅ Start = the **`talk` hub action** (first live 'anywhere' action): read-only NPC picker
   (`play:talkto:<npc-id>` + a `play:hub` back button) → `performTalk` under the character
   lock (busy re-entry per D22, presence re-checked at click time). The encounter-launched
   dialogue seam remains open (an `activity` encounter with `activityType: 'dialogue'`).

**Gates live in v1**: prior `flags` + `minTraits` (evaluated purely against session state —
the trait snapshot is kept current by in-session awards; the DB write stays authoritative).
`minRep` (S5), item-held, skill/attribute floors and role gates are additive catalog fields —
add the field + one evaluator branch when their systems exist, no migration.
**Effects live in v1**: `traits` deltas + session `flags`. Rep/currency/item/Stress effects
wait on their systems (same additive path). **AP**: talking is free; a **rolled** option
costs `DIALOGUE_CHECK_AP_COST = 1` 🟡 (the "a check is a meaningful action" rule above —
also the anti-farm: training speechcraft is priced like training foraging).

**Two v1 shape decisions** (documented in `game/activity/dialogue.ts`):
- **Session flags are the ONLY memory** — they die with the conversation (the "Where flags
  live long-term" open question below stands; durable quest flags/disposition need an owner
  call).
- **The NPC is NOT a session participant**: talking never makes the NPC busy, so one player
  chatting up the merchant cannot lock the shop for everyone (and the regen job never sees a
  "busy" NPC over a chat). Revisit if a dialogue ever mutates NPC state mid-session (trade,
  disposition) — then the NPC must join `participantIds` and its lock.
- No chronicle: a mundane chat is nobody's news (D24 reserves the feed for the noteworthy).

Reused with no new infra: the generic `activity` router, the check engine, `applyTraitDeltas`,
`creditSkillUse` (D40), the D22 busy/re-entry rules.

**The exit (D58)** — every `DialogueDefinition` carries a required `exit: ActivityExit`,
offered on every node next to the polite goodbyes: `small_talk` → "Cut them off", Marrek →
"Walk out on him" (its lines may use `{npc}`). The handler's `leave` action removes the
session first and only then applies the exit's trait deltas (none are authored yet). A
conversation never lapses on its own.
