import type { SkillNodeId } from '../data/skills.js';

// Fighting styles (D41, owner-designed) — the data-driven catalog of HOW a
// character fights, distinct from the skill tree (WHAT they know). A style is a
// switchable decision (the combat plan, game/combat/plan.ts, flips it mid-fight
// on conditions), not a skill node — but every style DRAWS ON a node: its path
// is summed into the style's attack and is the base of its defence, so knowing
// a style well means both hitting and defending better in it (the owner's rule),
// and fighting in a style trains that branch (learn-by-doing, D40). No unlock
// gate: an untrained style simply rolls at its untrained path — self-gating.
//
// Styles are FAMILY-specific (the owner's call: muay thai doesn't help with a
// sword in hand — and a greatsword ward is not a sidearm ward, D42): the
// fighter's family is resolved from what they wield (game/combat/profile.ts) —
// fists ⇒ unarmed, a weapon ⇒ its GRIP (one_handed / two_handed) — and only
// that family's styles apply. Ranged is a typed seam (no ranged combat in the
// engine yet); future grips (dual wield, sword-and-board) join the same way:
// extend the union + author that family's three styles, nothing else moves.
//
// The shape is deliberately flexible (owner's ask): a style may carry only
// `modifiers` (Striker), only `effects` (Grappler), or both (Stonewall) —
// adding an effect kind = one union member + one engine step. 🟡 Every number
// is a balance placeholder.

/** Which combat family a style belongs to — resolved from the fighter's hands
 *  (weapon grip decides the armed family — D42). */
export type StyleFamily = 'unarmed' | 'one_handed' | 'two_handed' | 'ranged';

/** How readily a style presses a landed blow into a follow-up (D42 momentum) —
 *  shifts the base follow-up chance in the engine (game/combat/duel.ts). */
export type StyleTempo = 'aggressive' | 'neutral' | 'defensive';

/** Flat d100-target / damage nudges while the style is active. */
export interface StyleModifiers {
   /** Added to the attack target (may be negative). */
   attack?: number;
   /** Added to the defence target (may be negative). */
   defense?: number;
   /** Added to every connecting blow's damage roll (before Soak). */
   damage?: number;
}

/** A style's characteristic behavior — one small, testable engine step each. */
export type StyleEffect =
   /** A connecting hit fouls the foe: their NEXT attack rolls at −attackPenalty. */
   | { kind: 'hamper'; attackPenalty: number }
   /** A defence won by ≥ minMargin SL answers with a counter-blow (Soak applies,
    *  the ≥1 connecting-hit rule too). */
   | { kind: 'riposte'; minMargin: number; damage: { min: number; max: number } };

export interface FightingStyle {
   name: string;
   emoji: string;
   /** One line, shown in the plan panel and the fight narration. */
   description: string;
   family: StyleFamily;
   /** The skill node this style draws on AND trains (see the header note). */
   node: SkillNodeId;
   /** How eagerly this style chains a landed blow (D42 momentum) — omitted =
    *  neutral. Aggressive styles press the attack; defensive ones reset to guard. */
   tempo?: StyleTempo;
   modifiers?: StyleModifiers;
   effects?: readonly StyleEffect[];
}

export const FIGHTING_STYLES = {
   // --- Unarmed (the Spire staples) — one archetype each: aggression, control,
   // counter. Their nodes are the brawling branches. --------------------------
   striker: {
      name: 'Striker',
      emoji: '🥊',
      description: 'Fists first, questions later — hit harder, guard less.',
      family: 'unarmed',
      node: 'striking',
      tempo: 'aggressive',
      modifiers: { attack: 10, defense: -10, damage: 2 },
   },
   grappler: {
      name: 'Grappler',
      emoji: '🤼',
      description: 'Clinch and smother — every hold fouls the foe\'s next swing.',
      family: 'unarmed',
      node: 'grappling',
      effects: [{ kind: 'hamper', attackPenalty: 15 }],
   },
   stonewall: {
      name: 'Stonewall',
      emoji: '🧱',
      description: 'Cover up, slip, and answer a clean block with a counter.',
      family: 'unarmed',
      node: 'guard',
      tempo: 'defensive',
      modifiers: { attack: -10, defense: 10 },
      effects: [{ kind: 'riposte', minMargin: 2, damage: { min: 1, max: 3 } }],
   },

   // --- One-handed — the same three archetypes with sidearm flavor; each draws
   // on its style branch under the one_handed grip (D42). ----------------------
   duelist: {
      name: 'Duelist',
      emoji: '🗡️',
      description: 'Press with point and edge — heavier blows, thinner guard.',
      family: 'one_handed',
      node: 'pressing',
      tempo: 'aggressive',
      modifiers: { attack: 10, defense: -10, damage: 2 },
   },
   binder: {
      name: 'Binder',
      emoji: '⛓️',
      description: 'Bind and hook the foe\'s weapon — every hit fouls their next swing.',
      family: 'one_handed',
      node: 'binding',
      effects: [{ kind: 'hamper', attackPenalty: 15 }],
   },
   warden: {
      name: 'Warden',
      emoji: '🛡️',
      description: 'Parry and keep distance — a clean parry answers with a counter.',
      family: 'one_handed',
      node: 'warding',
      tempo: 'defensive',
      modifiers: { attack: -10, defense: 10 },
      effects: [{ kind: 'riposte', minMargin: 2, damage: { min: 1, max: 3 } }],
   },

   // --- Two-handed — great-weapon takes on the archetypes, drawing on the
   // two_handed grip's style branches (D42). -----------------------------------
   wrath: {
      name: 'Wrath',
      emoji: '⚔️',
      description: 'Full-commitment cleaves — all edge, no brake.',
      family: 'two_handed',
      node: 'cleaving',
      tempo: 'aggressive',
      modifiers: { attack: 10, defense: -10, damage: 2 },
   },
   halfsword: {
      name: 'Halfsword',
      emoji: '🪝',
      description: 'Grip blade or haft to hook and wrestle — every hit fouls the foe\'s next swing.',
      family: 'two_handed',
      node: 'halfswording',
      effects: [{ kind: 'hamper', attackPenalty: 15 }],
   },
   iron_gate: {
      name: 'Iron Gate',
      emoji: '🏰',
      description: 'The braced low guard — let the storm break, then punish.',
      family: 'two_handed',
      node: 'iron_ward',
      tempo: 'defensive',
      modifiers: { attack: -10, defense: 10 },
      effects: [{ kind: 'riposte', minMargin: 2, damage: { min: 1, max: 3 } }],
   },
} as const satisfies Record<string, FightingStyle>;

export type FightingStyleId = keyof typeof FIGHTING_STYLES;

export const FIGHTING_STYLE_IDS = Object.keys(FIGHTING_STYLES) as FightingStyleId[];

/** Type guard for an id read off a DB doc / customId (D10 rule 3). */
export function isFightingStyleId(id: string): id is FightingStyleId {
   return id in FIGHTING_STYLES;
}

/** A style widened to `FightingStyle` — `as const satisfies` hides the optional
 *  fields on entries that omit them; go through this to read them uniformly. */
export function fightingStyle(id: FightingStyleId): FightingStyle {
   return FIGHTING_STYLES[id];
}

/** The styles a fighter of this family may adopt, in catalog order. */
export function stylesForFamily(family: StyleFamily): { id: FightingStyleId; style: FightingStyle }[] {
   return FIGHTING_STYLE_IDS
      .filter((id) => FIGHTING_STYLES[id].family === family)
      .map((id) => ({ id, style: FIGHTING_STYLES[id] }));
}

/** The style's effect of a given kind, or undefined — the engine's lookup. */
export function styleEffect<K extends StyleEffect['kind']>(
   id: FightingStyleId | null,
   kind: K,
): Extract<StyleEffect, { kind: K }> | undefined {
   if (!id)
      return undefined;

   return fightingStyle(id).effects?.find((effect): effect is Extract<StyleEffect, { kind: K }> => effect.kind === kind);
}
