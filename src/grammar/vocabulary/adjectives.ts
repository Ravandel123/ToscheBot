// Adjective pools. Situation themes (combat/labor/mystic/tavern/wilds) must read
// naturally on a BEING ("the grizzled sellsword") — the default patterns apply
// them to actors, never to props. Legacy pools ported from the old lexicon keep
// their original curation (insults are cartoonish, afflictions Darkest-Dungeon).

export const ADJECTIVES = {
   combat: ['battle-worn', 'bloodied', 'fearless', 'grizzled', 'reckless', 'unyielding'],
   labor: ['calloused', 'diligent', 'dusty', 'sturdy', 'tireless', 'weary'],
   mystic: ['ancient', 'cryptic', 'eerie', 'ill-omened', 'spectral', 'uncanny'],
   tavern: ['boisterous', 'half-drunk', 'loud-mouthed', 'merry', 'rowdy', 'tipsy'],
   wilds: ['feral', 'keen-eyed', 'ragged', 'sure-footed', 'wary', 'weather-beaten'],

   // --- Legacy pools -------------------------------------------------------------

   // Afflictions / virtues — Darkest-Dungeon-style temperaments (resolve checks, etc.).
   affliction: [
      'aberrant', 'abusive', 'aggressive', 'anxious', 'barbaric', 'brainwashed', 'cannibalistic', 'crazy',
      'degenerate', 'delusional', 'depressive', 'deviant', 'fearful', 'feral', 'ferocious', 'foolish', 'furious',
      'heartless', 'hopeless', 'idiotic', 'imbecilic', 'insane', 'irrational', 'maniacal', 'mindless', 'murderous',
      'paranoid', 'pathetic', 'perverse', 'primitive', 'psychopathic', 'ravenous', 'selfish', 'stupid',
   ],

   // Good-natured insult adjectives (Tosch is rude but in a cartoonish way).
   insult: [
      'aberrant', 'abominable', 'absurd', 'amateur', 'barbaric', 'bizarre', 'cave-dwelling', 'crazy', 'creepy',
      'delusional', 'drooly', 'drunken', 'feral', 'ferocious', 'gross', 'hideous', 'inane', 'insane', 'lazy',
      'lobotomized', 'mad', 'maniacal', 'monstrous', 'naive', 'narcissistic', 'nasty', 'ridiculous', 'silly',
      'starving', 'untamed', 'useless', 'vile', 'violent', 'wild',
   ],

   superb: ['amazing', 'incredible', 'out of scale', 'out of this world'],
   abysmal: ['trash', 'utter garbage'],

   virtue: [
      'clever', 'courageous', 'fearsome', 'focused', 'mighty', 'powerful', 'relentless', 'stalwart', 'undying', 'vigorous',
   ],
} as const satisfies Record<string, readonly string[]>;

export type AdjectiveTheme = keyof typeof ADJECTIVES;
