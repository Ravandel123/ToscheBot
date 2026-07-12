import { chance, randomItem } from '../lib/random.js';
import { randomSentence, SITUATION_THEMES } from '../grammar/sentence.js';
import { randomPerson } from './people.js';

// `h!rumor` — Tosch passes along completely made-up news. The first consumer of
// the situation sentence engine (grammar/sentence.ts): every rumor is a freshly
// composed themed sentence, sometimes starring a server regular as the culprit.

export const RUMOR_INTROS = [
   'Word around the garrison:',
   'The scouts swear it is true:',
   'A little bird told me:',
   'Fresh gossip from the mess hall:',
   'Keep it to yourself, but:',
   'The whole of Deltrada is talking:',
] as const;

/** One freshly fabricated rumor, e.g. "A little bird told me: Ravandel grimly outdrank a minstrel." */
export function rumorPhrase(): string {
   const theme = randomItem(SITUATION_THEMES);
   const sentence = chance(35)
      ? randomSentence([theme], { subject: randomPerson() })
      : randomSentence([theme]);

   return `${randomItem(RUMOR_INTROS)} ${sentence}`;
}
