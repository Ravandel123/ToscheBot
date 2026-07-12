// Adverb pools. Situation themes carry the tone of a scene ("grimly", "merrily");
// legacy pools are the old lexicon's manner/certainty/accuracy lists.

export const ADVERBS = {
   combat: ['fearlessly', 'grimly', 'relentlessly', 'ruthlessly', 'savagely', 'viciously'],
   labor: ['briskly', 'deftly', 'diligently', 'dutifully', 'steadily', 'tirelessly'],
   mystic: ['eerily', 'ominously', 'reverently', 'silently', 'solemnly', 'uncannily'],
   tavern: ['cheerfully', 'heartily', 'jovially', 'loudly', 'merrily', 'sloppily'],
   wilds: ['keenly', 'patiently', 'quietly', 'swiftly', 'warily'],

   // --- Legacy pools -------------------------------------------------------------

   // Accuracy qualifiers — note the empty string (often no qualifier at all).
   accuracy: [
      '', 'almost', 'below', 'definitely', 'exactly', 'less than', 'more than', 'over', 'precisely', 'probably',
   ],

   // "Without a doubt" style certainty terms.
   certainty: [
      'absolutely', 'assuredly', 'beyond a doubt', 'beyond any doubt', 'certainly', 'clearly', 'definitely',
      'for sure', 'incontrovertibly', 'indubitably', 'irrefutably', 'plainly', 'surely', 'truly', 'undeniably',
      'undisputedly', 'unequivocally', 'unmistakably', 'unquestionably', 'without a doubt',
   ],

   // Manner adverbs — for varied action narration ("Tosch savagely smites…"). Ported
   // from the old `advBase`. Reusable by combat flavour and commands alike.
   manner: [
      'absentmindedly', 'absolutely', 'abstractedly', 'abundantly', 'adoringly', 'aggressively', 'attractively', 'awkwardly',
      'beautifully', 'briskly', 'brutally',
      'cannibalistically', 'carefully', 'cautiously', 'cheerfully', 'cheerily', 'competitively', 'completely', 'conservatively', 'contritely', 'copiously', 'correctly', 'cosmically',
      'deadly',
      'eagerly', 'effectively', 'effortlessly', 'entirely', 'excellently', 'exceptionally', 'excessively', 'extravagantly', 'extremely',
      'famously', 'fantastically', 'faultlessly', 'feebly', 'foolishly', 'frantically', 'furiously',
      'gently', 'gingerly', 'girlishly', 'gorgeously', 'gracefully', 'graciously', 'grimly', 'guardedly',
      'half-heartedly', 'happily', 'heartlessly', 'hungrily',
      'idiotically', 'idly', 'inattentively',
      'lazily', 'lifelessly', 'loyally',
      'magnificently', 'maniacally', 'mindlessly',
      'narcissistically', 'nimbly',
      'overly',
      'perfectly', 'pathetically', 'pleasantly', 'plentifully', 'practically', 'primitively', 'profusely', 'properly', 'purely',
      'quietly', 'questioningly', 'quizzically',
      'ravenously', 'recklessly', 'remorsefully', 'rightly', 'ruefully', 'ruthlessly',
      'savagely', 'silently', 'slightly', 'sloppily', 'splendidly', 'stupidly', 'stylishly', 'superbly', 'sunnily',
      'terribly', 'thirstily', 'totally',
      'unabashedly', 'unevenly', 'urgently', 'utterly',
      'viciously',
      'warily', 'weakly', 'wishfully', 'witlessly', 'wholly', 'worriedly',
   ],
} as const satisfies Record<string, readonly string[]>;

export type AdverbTheme = keyof typeof ADVERBS;
