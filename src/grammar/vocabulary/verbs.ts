// Verb pools for the sentence engine (grammar/sentence.ts). Authoring contract —
// the default pattern banks RELY on it:
//   • base form, SINGLE word (the inflection modifiers operate on word endings);
//   • transitive, and sensible with a PERSON as the object ("ambushes a bandit") —
//     the default patterns pair #verb# with #being#, never with #noun# props.
// A word may appear under several themes; a theme = one situation the words fit.
// Adding a theme = one key here (mirror it across the other classes to make it a
// full SituationTheme); adding a word = one array entry.

export const VERBS = {
   combat: ['ambush', 'batter', 'corner', 'disarm', 'harry', 'outflank', 'overpower', 'rout', 'smite', 'strike'],
   labor: ['assist', 'hire', 'outwork', 'overwork', 'pay', 'praise', 'scold', 'supervise'],
   mystic: ['beguile', 'bless', 'curse', 'haunt', 'mesmerize', 'spook', 'ward'],
   tavern: ['challenge', 'charm', 'entertain', 'mock', 'outdrink', 'serve', 'toast'],
   wilds: ['chase', 'evade', 'outrun', 'shadow', 'snare', 'stalk', 'startle', 'tame', 'track', 'trail'],
} as const satisfies Record<string, readonly string[]>;

export type VerbTheme = keyof typeof VERBS;
