// Flavor remarks for `h!rate`, grouped by score tier. Pure data (D10) — the
// command picks a tier from the rolled score and a random remark from it.

export const RATING_REMARKS = {
   low: [
      'Truly the work of an Ermehn.',
      'I have seen river silt with more promise.',
      'Burn it. Burn it with the village.',
      'Even Clovis would be disappointed, yes-yes.',
   ],
   mid: [
      'Acceptable. Barely.',
      'It will do, soldier. It will do.',
      'Neither glory nor shame. How very Deltradan.',
      'I have rated worse. I have rated better.',
   ],
   high: [
      'A masterstroke worthy of the Western Deep!',
      'The General approves, yes-yes.',
      'I would march into battle for this.',
      'Flawless. Do not let it go to your head.',
   ],
} as const;
