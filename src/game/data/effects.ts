import type { AttributeKey } from './attributes.js';

// Timed effects (a content catalog): temporary states a character carries for a
// while — a drink's courage today; wounds, weather exposure, a blessing later.
// The character stores only `{ effectId, expiresAt }`; what an effect DOES
// resolves from here at read time, so rebalancing one needs no migration.
// Every number is 🟡.

export interface EffectDefinition {
   name: string;
   emoji: string;
   description: string;
   /** How long one application lasts. Re-applying restarts the clock. */
   durationMinutes: number;
   /** Shifts to effective attributes while active. */
   attributes?: Partial<Record<AttributeKey, number>>;
   /** Flat shift to every d100 check target while active. */
   checkBonus?: number;
}

export const EFFECTS = {
   dutch_courage: {
      name: 'Dutch Courage',
      emoji: '🍺',
      description: 'Warm, bold and a little slow on the uptake.',
      durationMinutes: 120,
      attributes: { willpower: 5, perception: -5 },
   },
} as const satisfies Record<string, EffectDefinition>;

export type EffectId = keyof typeof EFFECTS;

/** What a character document stores per running effect. */
export interface ActiveEffectState {
   effectId: string;
   expiresAt: Date;
}

/** Bound on stored effects per character (embedded array). */
export const MAX_ACTIVE_EFFECTS = 10;

/** Resolves a stored effect id, tolerating unknown ids. */
export function effectDefinition(id: string): EffectDefinition | undefined {
   return (EFFECTS as Record<string, EffectDefinition>)[id];
}
