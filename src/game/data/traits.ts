// Deed traits — who a character is BECOMING, grown by choices, not points
// (RPG/Ruleset.md §11 "Character (deed) traits", P-traits direction): ignore a
// drowning stranger → +cowardice; dive in after them → +courage. Independent
// rising meters (courage and cowardice can coexist — people are complicated),
// clamped ≥ 0, starting at 0. Nothing GATES on thresholds yet — encounters only
// accrue them; consumers (trait-gated dialogue, titles, stress interplay) come
// with the Phase 7 ruleset. Ids are stable slugs (D10): append, never rename.

export interface TraitDefinition {
   name: string;
   emoji: string;
   description: string;
}

export const TRAITS = {
   courage: { name: 'Courage', emoji: '🦁', description: 'Held firm when it would have been easier to flee.' },
   cowardice: { name: 'Cowardice', emoji: '🐀', description: 'Looked away when someone needed you.' },
   mercy: { name: 'Mercy', emoji: '🕊️', description: 'Spared, forgave, and helped the fallen.' },
   cruelty: { name: 'Cruelty', emoji: '🩸', description: 'Chose the vicious path when a kinder one existed.' },
   honor: { name: 'Honor', emoji: '⚖️', description: 'Kept your word and fought fair.' },
   empathy: { name: 'Empathy', emoji: '💞', description: 'Felt for strangers and acted on it.' },
} as const satisfies Record<string, TraitDefinition>;

export type TraitKey = keyof typeof TRAITS;

export const TRAIT_KEYS = Object.keys(TRAITS) as TraitKey[];
