import type { ItemKindId } from '../data/items.js';

// Bout modes — the data-driven RULESET layer for the Smackdown (D35 combat, D10
// content-in-code). A "bout mode" is everything that shapes a fight BEFORE the
// engine rolls: how gear is treated, where it's fought, who the opponent is.
// Adding a mode = one catalog entry (test-validated) + wiring nothing new, so
// the Spire can grow into the big feature the owner wants.
//
// Consumed TODAY: `loadout` (gear on/off) + `selectable` (shown in the picker).
// Everything else is a DESIGNED SEAM — typed and authored, but the mechanics
// behind it are deferred (marked 🟡/future):
//   * `arena`      — terrain tags + obstacles (combat.md R25): a sandy pit that
//                    hinders footwork, scattered cover. Not read by the engine yet.
//   * `allowedWeaponKinds` — restrict what may be wielded (an axes-only bout).
//                    Not enforced yet (the finer "axes only" needs a weapon
//                    category tag on items — a one-field future refinement).
//   * `opponent`   — 'player' (consent-gated PvP, all modes today) or 'npc'
//                    (a PvE Trial vs an ever-tougher champion — the engine already
//                    takes two CombatProfiles, so an NPC is just a hand-authored
//                    profile with consent auto-granted; the seam for #PvE).
//   * `stakes`     — 'real' (persisted Health, the duel) vs 'fantasy' (throwaway,
//                    like sparring): lets this framework absorb sparring later.

/** How a fighter's gear feeds their CombatProfile (game/combat/profile.ts). */
export type BoutLoadout =
   /** Fight with whatever is worn/wielded (D28) — armour, weapon and all. */
   | 'as-equipped'
   /** Gear is set aside at the door: no weapon, no armour, no equip modifiers —
    *  pure body. Items are untouched in the pack; they just don't count here. */
   | 'unarmed-unarmored';

/** Terrain a bout is fought on (combat.md R25) — a lookup, not a simulation.
 *  DESIGNED, not consumed: no engine step reads these yet. */
export type TerrainTag = 'sand' | 'cramped' | 'uneven' | 'slick' | 'open';

export interface BoutArena {
   name: string;
   /** Tags styles/weapons will check against once R25 lands (sand hinders footwork…). */
   terrain: readonly TerrainTag[];
   /** Whether scattered obstacles/cover feature in the fight. */
   obstacles: boolean;
}

export interface BoutMode {
   name: string;
   emoji: string;
   description: string;
   loadout: BoutLoadout;
   /** 'real' spends & persists Health (duel); 'fantasy' is throwaway (sparring). */
   stakes: 'real' | 'fantasy';
   /** Whether players may pick it in `/smackdown duel` today. A future mode ships
    *  `false` until its deferred mechanics (arena/weapon-filter) are built. */
   selectable: boolean;
   /** SEAM — who the opponent is; all modes are 'player' (consent) today. */
   opponent: 'player' | 'npc';
   /** SEAM — permitted weapon kinds (undefined = any). Not enforced yet. */
   allowedWeaponKinds?: readonly ItemKindId[];
   /** SEAM — the arena + its terrain/obstacles (undefined = the plain Spire floor). */
   arena?: BoutArena;
}

export const BOUT_MODES = {
   // Fight as you stand — the default serious bout: your weapon, your armour.
   geared: {
      name: 'Full Gear',
      emoji: '🗡️',
      description: 'Fight with everything you carry — weapon, armour, the lot.',
      loadout: 'as-equipped',
      stakes: 'real',
      selectable: true,
      opponent: 'player',
   },
   // Stripped to the body — armour and weapons set aside at the door.
   bare: {
      name: 'Bare-Knuckle',
      emoji: '🥊',
      description: 'No weapons, no armour — gear is left at the door. Just body, grit and technique.',
      loadout: 'unarmed-unarmored',
      stakes: 'real',
      selectable: true,
      opponent: 'player',
   },
   // FUTURE reference (owner's example, #arena) — proves the shape end to end but
   // stays UN-selectable until the R25 arena + weapon-filter mechanics exist. Flip
   // `selectable` to true then; no other wiring changes.
   sand_axes: {
      name: 'Sands of the Axe',
      emoji: '🪓',
      description: 'Axes only, fought on shifting sand with cover scattered about — footing is treacherous.',
      loadout: 'as-equipped',
      stakes: 'real',
      selectable: false,
      opponent: 'player',
      allowedWeaponKinds: ['weapon'],
      arena: { name: 'The Sandpit', terrain: ['sand', 'uneven'], obstacles: true },
   },
} as const satisfies Record<string, BoutMode>;

export type BoutModeId = keyof typeof BOUT_MODES;

/** The default bout when a challenger picks nothing — fight as you stand. */
export const DEFAULT_BOUT_MODE: BoutModeId = 'geared';

export function isBoutModeId(id: string): id is BoutModeId {
   return id in BOUT_MODES;
}

/** Resolves a stored/customId bout mode, falling back to the default for an
 *  unknown or now-unselectable id (D10 rule 3 — a renamed mode never crashes). */
export function boutMode(id: string): BoutMode & { id: BoutModeId } {
   const resolved: BoutModeId = isBoutModeId(id) && BOUT_MODES[id].selectable ? id : DEFAULT_BOUT_MODE;
   return { id: resolved, ...BOUT_MODES[resolved] };
}

/** The modes a player may choose in the `/smackdown duel` picker, in catalog order. */
export function selectableBoutModes(): { id: BoutModeId; mode: BoutMode }[] {
   return (Object.keys(BOUT_MODES) as BoutModeId[])
      .filter((id) => BOUT_MODES[id].selectable)
      .map((id) => ({ id, mode: BOUT_MODES[id] }));
}
