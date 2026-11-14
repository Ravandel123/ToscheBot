# PLAN.md — the plan the owner and the assistant agreed on

This file holds only what was **decided together**. Nothing here is the assistant's private
to-do list. How to read it:

- **Now** — the next things to build, written out concretely enough to start work.
- **Next** — the order after that, one line each. Details are written when a step moves up.
- **To decide** — proposals waiting for the owner's yes, no or change.
- **Known issues** — real, accepted, not scheduled.
- **Done** — what was finished, newest first.

Status marks: ✅ agreed · 🟡 proposed by the assistant, not yet confirmed by the owner.

To run something: *"Przeczytaj CLAUDE.md i PLAN.md. Zrób N1."*

## Rules

1. **One system at a time.** A step is finished when it is playable on the live server.
2. **Unfinished = hidden.** No "coming soon" buttons, no skill trees nothing can train, no
   meter nothing spends. Hidden things stay in their catalogs, flagged, until they go live.
3. **Complex inside, one button outside.** A player who never opens a breakdown must still
   be able to play everything.
4. **Numbers are 🟡 until the owner signs off.** When balance is not obvious, simulate first
   and report the distribution.
5. **Done means:** `npm run build` + `lint` + `test` green, the matching `Ruleset/` file
   updated in the same change, `przewodnik.md` updated if the change touches anything it
   describes, and a note here if a slash definition changed (the owner runs
   `npm run deploy`).
6. **Git is the owner's.** The assistant edits files; the owner commits and pushes.

## Now

### N1. Try the 2026-11-14 work on the live bot · owner
Built and covered by tests, never run on Discord. After the owner ops at the bottom of
this file, check:

- **Unfinished activities.** Start a travel challenge, leave it, come back hours later: it
  is still there. Use another command meanwhile: it names what is unfinished and shows the
  step. Take the exit at "A cry from the river": back at the origin, +1 Cowardice.
  `h!session` lists the open sessions and ends one.
- **One command.** `/play` shows Pack / Skills / Fighting style buttons; each turns the
  hub into its panel, and "Back to /play" turns it back (also on panels opened by their own
  command). `/character combat` asks one question; "Tactics…"
  opens the full editor. `/character view` has a Refresh button anyone can press.
- **Challenge spam.** A second `/smackdown duel` within 30 s is refused; so is a challenge
  to someone who has not answered the last one.
- **The stall.** At the plaza in the morning or daytime, "Browse the market": buy, sell,
  buy back, empty the till. At night it is shut.
- **How it reads.** Whether the exit lines, the stall panel and the simple fighting panel
  feel right is for the owner to judge — the wording is a first draft.

### N2. The merchant, second pass · ✅ direction (owner, 2026-11-14), details open
The plaza merchant is already a real NPC character: his pack is the stall, his coins the
till (D60). His only behaviour is a reset at the start of each game day. The owner wants
merchants — and then the other NPCs — to have a simple mind of their own instead. To settle
before building:

- 🟡 What a merchant does by himself: restock from where (other NPCs, a caravan that
  arrives on some days), raise the price of what sells out, close early when the till is
  empty.
- 🟡 Whether the stock list, the till (250 a day) and the sell rate (half) are right — see
  "To decide" 7.
- This is the first slice of "NPCs acting behind the scenes" in "Later"; design it so the
  same routine shape serves the tavernkeeper and the guards next.

## Next

4. **Action Points** — prices for travel, fights and gathering; the effort choice (see "To
   decide" 2).
5. **Skill ratings** — see "To decide" 3. Small code change, mostly a rule for new content.
6. **Stamina in combat** — each exchange costs Stamina by style; empty = "winded"; combat
   plans gain an "own Stamina below X %" rule. Simulate first. A good moment to split the
   duel engine into single steps (see Known issues).
7. **Fishing** — second gathering profession on the existing engine. A plain roll, not a
   minigame. Fish sell at the shop.
8. **Tavern** — `drink` goes live; gambling after it, with its own rules file first.

Later, unordered: NPCs acting behind the scenes (a real NPC-to-NPC economy replacing the
daily budget, NPC movement — the owner's flagship idea, needs its own design) · crafting ·
gambling salon · faction reputation · Stress/Sanity · hunger and thirst · XP, talents, Roles
· combat depth (hit locations, crits, manual turns) · travel-encounter stakes · ambient chat
events · a weekly co-op event · more locations, encounters and dialogue trees.

## To decide (owner)

**1. Starter kit.** Switched off on 2026-11-14 at the owner's request ("this needs a closer
look") — the mechanism stays, nothing is issued. To decide: whether a new character gets
anything at all, and what. Until then a new character has no gear and no coins, so the first
coins come from the Spire ladder (fought bare-handed) or from selling foraged finds. Options:
a small purse instead of items (🟡 30 coins — the player chooses at the stall), the old kit,
or nothing.

**2. Action Points — effort levels.**

| Effort | Cost | What happens |
|---|---|---|
| Quick | 1 AP | One roll, as today |
| Careful | 2 AP | One roll at +15 % |
| Long shift | 5 AP | Five quick rolls, one summary message |

Careful work teaches less with no new rule: skill gain is `2 × (1 − chance)`. Travel 1 AP,
a fight 1 AP. AP stays uncapped; the long shift is how a banked pile gets spent.

**3. Skill ratings.** Measured: an untrained character has 9 % on a standard Smithing task
and 30 % on a standard Athletics task (attribute weights sum to 0.3 vs 1.0); after 500 uses
a three-node path totals 46 points, a one-node skill 12. Proposal:

- **Rating.** Every task has a Rating — the skill total at which it is a coin flip.
  `chance = 50 + total − Rating`. Same engine as today, existing content unchanged.
- **Equal start.** Every skill's attribute weights sum to the same total (🟡 1.0).
- **Tasks live at their depth.** Basic tasks check the root (Rating 30–80, same band in
  every skill), specialist tasks a branch (80–160), expert tasks a leaf (160–260+). A
  one-node skill ends at the basic band; a deep tree keeps going.
- **Own-node floor.** Advanced content may require N points in its own node. A new leaf
  starts at 0 for everyone, so new content means new work even for a master.
- **No separate Mastery rule** (owner not convinced by "+1 Success Level per 20 over 100").
  Quality reads the margin (`total − Rating`) plus the roll's luck. The 5–95 clamp applies
  only where there is risk. A routine task far below the character's level (margin about
  +50 or more) is not rolled: automatic success, no learning.

| Uses | Days at 24 AP | Root | Branch | Leaf | Three-node total |
|---|---|---|---|---|---|
| 100 | 4 | 6 | 6 | 8 | 20 |
| 500 | 21 | 12 | 15 | 19 | 46 |
| 2,000 | 83 | 23 | 32 | 38 | 93 |
| 5,000 | 208 | 38 | 51 | 59 | 148 |
| 15,000 | 625 | 64 | 100 | 100 | 264 |

**4. Dutch Courage** (Honeyed Mead: +5 Willpower, −5 Perception, 2 h) — keep, change or drop.

**5. What a tavern drink does** (blocks step 8).

**6. `Ruleset/` clean-up, part two.** Done 2026-11-11: rules and implementation are in
separate files (`Ruleset/<topic>.md` vs `Ruleset/implementation/<topic>.md`), moved without
rewording. Still open:
- 🟡 Read each rule file once and remove what the split left behind: code paths and
  "built" notes inside rule text, and statements that are out of date. One topic at a time,
  starting with the one being built.
- `Ruleset/RPG/` (local, not in git, frozen at July 2026) — the owner deletes it, or keeps
  it as a private archive. Its content was checked against the topic files when it was
  first folded in.
- `Ruleset/TODO.md` — both its items are tracked here (To decide 3, "Later").

**7. Shop numbers.** First guesses, all 🟡: the merchant pays half of an item's value; the
till starts each day at 250 coins; the stock is 4 kinds of food and healing plus 10 pieces
of basic gear (list in `Ruleset/economy.md`). For scale: the Spire ladder pays 1,680 coins
in total per character, a foraged find is worth 1–12.

**8. What an exit costs.** Agreed: an exit is never better than the worst choice. The two
authored costs are first guesses: giving up at the fallen tree is free (failing there is
free too); backing away from the drowning stranger costs 1 Cowardice. Cutting a conversation
short costs nothing yet, because NPCs do not remember how they were treated.

## Known issues

- **Duel engine resolves a whole fight in one function.** Group fights and manual turns
  need it split into single steps. Planned alongside step 6.
- **Fight narration runs under the fighters' locks** (30–45 s). The outcome is already
  saved first; the only effect is "character is busy" for the participants meanwhile.
- **Session state has no version.** A deploy that changes an activity's state shape can
  confuse a session in progress. Deploy when nobody is mid-activity, or read old shapes
  tolerantly.
- **Comments cite decision numbers and old paths** (`RPG/`, old plan step numbers). Fix a
  file's comments when touching it; do not add new ones.
- **Both bots answer in `tosche-office`** and on ambient chance when the test bot runs on
  the shared server.
- **Two players can talk to the same NPC at once.** Fine while dialogue does not change NPC
  state.
- **A character parked in an activity cannot be touched.** Sessions never expire, so a
  player can leave a character busy for good. Harmless today (duels need consent). Once
  something can target a character without consent — theft, an NPC attack — being busy
  must not be a shield.
- **A new character has no gear** while the starter kit is off (To decide 1).
- **One unexplained test failure.** On 2026-11-14 one run of eight failed three tests in
  one file; it was the first run after hours idle and took half again as long, and the next
  seven passed. Probably a timeout on a cold start. If it shows up in CI, find the file.

## Done

- **2026-11-14** — Activities never expire and every one has an in-character exit;
  `h!session` for the owner. Hub shortcuts, the two-level fighting-style panel, Refresh on
  the public sheet, the duel-challenge spam guard. The first shop: the plaza merchant
  trades from his own pack and purse. Starter kit switched off.
- **2026-11-11** — `Ruleset/` split into rule files and `Ruleset/implementation/`.
  `przewodnik.md` rewritten from scratch; keeping it current is now a rule in `CLAUDE.md`.
- **2026-11-11** — Regeneration catches up after downtime (hours missed while offline are
  paid at startup; capped at a week). `AI_TRIGGER_NAMES` lets the test bot answer to its
  own name. Docs tidied: `AUDIT.md` and `STATE.md` folded into `CLAUDE.md` and this file.
- **2026-11-11** — Groundwork: modifier layer with timed effects; `npm run migrate`.
- **2026-11-11** — Steps 1–3: repeated-discovery bug fixed; unbuilt hub actions, unused
  skill trees and Stamina hidden; duels and trials save before narrating and write records;
  `/smackdown sparring` and Elo removed; "Enter the arena" at the Spire; starter kit;
  database connect retry at startup; real seed roster moved to a gitignored file.
- **2026-11-10** — Full review of the project; plan rebuilt.
- **Earlier (July 2026)** — everything listed under "Status" in `CLAUDE.md`.

**Owner ops outstanding:**
- `npm run deploy` — `/smackdown` lost `sparring`, `/leaderboard` has new categories,
  `/character combat` has a new description.
- `h!backup`, then `npm run migrate` once on the live database — drops the old sparring
  record fields and the session time limit. Until it runs, sessions that were open before
  the update can still vanish; new ones cannot.
- `npm run seed-npcs` on the live database if it has no NPCs yet — the stall needs the
  merchant character to exist.
