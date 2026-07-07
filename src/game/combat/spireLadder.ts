import type { CombatProfile } from './duel.js';
import type { FamilyPlan } from './plan.js';

// The Smackdown Spire PvE ladder (owner-requested #PvE): a fixed gauntlet of
// champions who exist ONLY in the Spire — each tougher than the last. A player
// fights the next unbeaten rung; a win advances them and pays a one-time reward,
// a loss costs real Health (like a duel — D35). Champions are hand-authored
// CombatProfiles (D10 content-in-code), NOT world NPCs and NOT DB characters —
// the engine (`resolveDuel`) takes two CombatProfiles, so a champion is just a
// stat block with no owner and no consent needed.
//
// Several champions carry a fighting style / combat plan (D41) — their blurbs
// already telegraphed one (Osk grapples, Dourmane counters), and watching a
// champion switch under pressure teaches players the plan system exists. A
// champion has no per-style targets: its authored attack/defence ARE its style's
// bases (the stat block already prices its skill), only modifiers/effects apply.
//
// 🟡 Every number + the roster is a balance/content placeholder. Adding or
// retuning a rung is one catalog edit; the difficulty curve is meant to climb
// from a warm-up to a brutal grand champion.

/** The combat numbers of a champion — the CombatProfile minus the per-fight
 *  identity/health the builder fills in. `plan` is the champion's standing
 *  orders (unarmed styles only — the Spire ladder brawls). */
export type ChampionStats = Pick<
   CombatProfile,
   'maxHealth' | 'attackTarget' | 'defenseTarget' | 'damage' | 'damageType' | 'strengthBonus' | 'soak' | 'initiative'
> & { plan?: FamilyPlan };

export interface ChampionReward {
   /** Deltrada Coins paid the first time this rung is cleared (D19 single currency). */
   coins: number;
   // SEAM: a title, a unique item, or a Spire-reputation bump belong here once
   // those systems exist (titles are an idea-backlog item; items = D28/D33).
}

export interface SpireChampion {
   id: string;
   name: string;
   title: string;
   /** Tosche's one-line introduction, shown before the bout. */
   blurb: string;
   stats: ChampionStats;
   reward: ChampionReward;
}

// Ordered easiest → hardest. Index = rung (0-based); a character's `trialRung`
// is the NEXT rung they must beat. Flavored across the BtWD races.
export const SPIRE_LADDER = [
   {
      id: 'pip',
      name: 'Pip',
      title: 'the Warm-Up',
      blurb: 'A wiry tamian who mostly dances. Good for shaking off the rust — go easy on the little one, no-no.',
      stats: { maxHealth: 14, attackTarget: 40, defenseTarget: 26, damage: { min: 2, max: 4 }, damageType: 'impact', strengthBonus: 1, soak: 1, initiative: 4 },
      reward: { coins: 20 },
   },
   {
      id: 'bricktooth',
      name: 'Bricktooth',
      title: 'the Regular',
      blurb: 'A canid who has lost more bouts than he\'s won, but he keeps coming back. Slow, stubborn, hits like a door.',
      stats: { maxHealth: 16, attackTarget: 45, defenseTarget: 28, damage: { min: 3, max: 5 }, damageType: 'impact', strengthBonus: 2, soak: 2, initiative: 4 },
      reward: { coins: 35 },
   },
   {
      id: 'sela',
      name: 'Sela Quickpaw',
      title: 'the Flurry',
      blurb: 'A felis who\'d rather not get hit at all. All footwork and fast little jabs — you\'ll swing at air.',
      stats: { maxHealth: 16, attackTarget: 48, defenseTarget: 36, damage: { min: 3, max: 6 }, damageType: 'slash', strengthBonus: 2, soak: 2, initiative: 8, plan: { style: 'striker', rules: [] } },
      reward: { coins: 55 },
   },
   {
      id: 'marrow',
      name: 'Old Marrow',
      title: 'the Journeyman',
      blurb: 'A grey-muzzled ermehn who has seen it all. No wasted motion. He\'ll make you earn every step.',
      stats: { maxHealth: 18, attackTarget: 51, defenseTarget: 32, damage: { min: 4, max: 7 }, damageType: 'slash', strengthBonus: 3, soak: 3, initiative: 5, plan: { style: 'stonewall', rules: [] } },
      reward: { coins: 80 },
   },
   {
      id: 'osk',
      name: 'Tidewarden Osk',
      title: 'the Undertow',
      blurb: 'A lutren built like a river barge. Grapples, drags, and never seems to tire. Patience is his weapon.',
      stats: { maxHealth: 20, attackTarget: 53, defenseTarget: 37, damage: { min: 4, max: 7 }, damageType: 'impact', strengthBonus: 3, soak: 3, initiative: 6, plan: { style: 'grappler', rules: [] } },
      reward: { coins: 110 },
   },
   {
      id: 'busk',
      name: 'Ironhide Busk',
      title: 'the Anvil',
      blurb: 'A polcan you could break a chair on. He\'ll let you tire yourself out, then flatten you at leisure.',
      stats: { maxHealth: 22, attackTarget: 55, defenseTarget: 33, damage: { min: 5, max: 8 }, damageType: 'impact', strengthBonus: 4, soak: 5, initiative: 5, plan: { style: 'stonewall', rules: [{ trigger: { kind: 'foe-health-below', value: 50 }, style: 'striker' }] } },
      reward: { coins: 150 },
   },
   {
      id: 'vesh',
      name: 'Vesh',
      title: 'the Cutthroat',
      blurb: 'A vulpin who fights dirty and fast. Blink and you\'ll be bleeding. The crowd loves to hate this one.',
      stats: { maxHealth: 18, attackTarget: 59, defenseTarget: 41, damage: { min: 5, max: 9 }, damageType: 'pierce', strengthBonus: 3, soak: 3, initiative: 8, plan: { style: 'striker', rules: [] } },
      reward: { coins: 190 },
   },
   {
      id: 'dourmane',
      name: 'Captain Dourmane',
      title: 'the Drillmaster',
      blurb: 'A canid officer who treats the Spire like a parade ground. Textbook guard, textbook counters. No openings.',
      stats: { maxHealth: 24, attackTarget: 61, defenseTarget: 43, damage: { min: 6, max: 10 }, damageType: 'slash', strengthBonus: 4, soak: 5, initiative: 6, plan: { style: 'stonewall', rules: [] } },
      reward: { coins: 240 },
   },
   {
      id: 'sand_widow',
      name: 'The Sand Widow',
      title: 'the Merciless',
      blurb: 'A felis nobody has beaten twice. She fights like the fight already bores her — and it usually does.',
      stats: { maxHealth: 24, attackTarget: 65, defenseTarget: 47, damage: { min: 6, max: 10 }, damageType: 'slash', strengthBonus: 4, soak: 4, initiative: 9, plan: { style: 'striker', rules: [{ trigger: { kind: 'self-health-below', value: 35 }, style: 'stonewall' }] } },
      reward: { coins: 300 },
   },
   {
      id: 'aurok',
      name: 'Grand Champion Aurok',
      title: 'the Undefeated',
      blurb: 'The mountain at the top of the Spire. Bigger, faster and meaner than anyone has a right to be. Good luck, soldier — you\'ll need it.',
      stats: { maxHealth: 30, attackTarget: 70, defenseTarget: 50, damage: { min: 6, max: 12 }, damageType: 'impact', strengthBonus: 5, soak: 7, initiative: 8, plan: { style: 'grappler', rules: [{ trigger: { kind: 'foe-health-below', value: 40 }, style: 'striker' }] } },
      reward: { coins: 500 },
   },
] as const satisfies readonly SpireChampion[];

export const LADDER_LENGTH = SPIRE_LADDER.length;

/** The champion a fighter faces at `rung` (their next unbeaten rung), or null
 *  once the whole ladder is cleared (`rung >= LADDER_LENGTH`). */
export function championAtRung(rung: number): SpireChampion | null {
   return SPIRE_LADDER[rung] ?? null;
}

/** The 0-based rung of a champion by id, or -1 if unknown (D10 rule 3). */
export function championRungById(id: string): number {
   return SPIRE_LADDER.findIndex((champion) => champion.id === id);
}

/** What fighting a chosen (or defaulted) opponent means, given how far the
 *  character has climbed (`clearedRung` = beaten count = next unbeaten index):
 *   - `climb`   — the next unbeaten champion (rewards + advances on a win);
 *   - `rematch` — an already-beaten champion (NO reward, real Health at stake);
 *   - `locked`  — a champion further up the ladder than earned (refused);
 *   - `cleared` — nothing left to climb (only when no specific opponent asked). */
export type TrialTarget =
   | { kind: 'climb'; rung: number; champion: SpireChampion }
   | { kind: 'rematch'; rung: number; champion: SpireChampion }
   | { kind: 'locked'; rung: number; champion: SpireChampion }
   | { kind: 'cleared' };

/** Resolves the trial target from an optional requested champion id + progress.
 *  Pure — decided the same way pre-lock (for the message) and under the lock
 *  (authoritative). An unknown id degrades to the plain climb (D10 rule 3). */
export function trialTarget(requestedId: string | null, clearedRung: number): TrialTarget {
   if (!requestedId)
      return climbOrCleared(clearedRung);

   const rung = championRungById(requestedId);
   if (rung < 0)
      return climbOrCleared(clearedRung);

   const champion = SPIRE_LADDER[rung];
   if (rung > clearedRung)
      return { kind: 'locked', rung, champion };
   if (rung === clearedRung)
      return { kind: 'climb', rung, champion };

   return { kind: 'rematch', rung, champion };
}

function climbOrCleared(clearedRung: number): TrialTarget {
   const champion = championAtRung(clearedRung);
   return champion ? { kind: 'climb', rung: clearedRung, champion } : { kind: 'cleared' };
}

/** Builds an engine-ready CombatProfile for a champion — always at full Health,
 *  with a synthetic id that can never collide with a real Character uuid.
 *  `attackNode` is nominal (champions brawl, and never persist skill credit);
 *  no per-style targets — the authored stats are the style's bases (D41). */
export function championProfile(champion: SpireChampion): CombatProfile {
   return {
      characterId: `spire:${champion.id}`,
      name: `${champion.name}, ${champion.title}`,
      health: champion.stats.maxHealth,
      attackNode: 'striking',
      family: 'unarmed',
      ...champion.stats,
   };
}
