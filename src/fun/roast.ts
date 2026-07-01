import { chance, randomItem } from '../lib/random.js';
import { bold, indefiniteArticle } from '../lib/text.js';
import { ANIMALS, CLASSES, FUNNY_CLASSES, INSULT_ADJECTIVES, PLACES } from '../lexicon.js';
import { RACES } from '../game/data/races.js';
import { randomPerson } from './people.js';

// `h!animal` / `h!race` / `h!class` / `h!whois` — Tosch tells someone what they
// "really" are. Ported from the old animal/race/class/whois cases. All share one
// "looks like a(n) X" frame; each just feeds a different noun pool.

const RACE_NAMES = Object.values(RACES).map((r) => r.name);
const ALL_CLASSES = [...CLASSES, ...FUNNY_CLASSES];
const CLASS_PREFIXES = ['Battle', 'Blood', 'Bone', 'Death', 'Feral', 'Frost', 'Ghost', 'Hedge', 'Iron', 'Plague', 'Savage', 'Shield', 'Soul', 'Storm', 'War', 'Wild'] as const;

/** A bolded noun with its article: "an **Otter**", "a **Knight**". */
function withArticle(noun: string): string {
   const article = indefiniteArticle(noun);
   return article ? `${article} ${bold(noun)}` : bold(noun);
}

/** A class title — mostly plain, sometimes "Prefix Class" (e.g. "Blood Knight"). */
export function composedClass(): string {
   const base = randomItem(ALL_CLASSES);
   return chance(35) ? `${randomItem(CLASS_PREFIXES)} ${base}` : base;
}

/** The shared roast frame: "{who} looks like {a thing}", occasionally a cross or a place. */
function roastFrame(who: string, pick: () => string): string {
   const thing = withArticle(pick());

   return randomItem([
      `I think ${who} looks like ${thing}.`,
      `I think ${who} would do great as ${thing}.`,
      `${who} looks like ${thing}.`,
      `${who} would do well as ${thing}.`,
      `${who} looks like ${thing} from ${bold(randomItem(PLACES))}.`,
      `${who} looks like a cross between ${thing} and ${withArticle(pick())}.`,
   ]);
}

export const animalRoast = (who: string): string => roastFrame(who, () => randomItem(ANIMALS));
export const raceRoast = (who: string): string => roastFrame(who, () => randomItem(RACE_NAMES));
export const classRoast = (who: string): string => roastFrame(who, composedClass);

/** "{who} is my savage Troglodyte." — an identity verdict, sometimes a place sighting. */
export function whoisPhrase(who: string): string {
   if (chance(30)) {
      return randomItem([
         `I think I saw ${who} in ${bold(randomItem(PLACES))}.`,
         `${who} was with me in ${bold(randomItem(PLACES))}.`,
         `I have definitely seen ${who} in ${bold(randomItem(PLACES))}.`,
      ]);
   }

   const owner = chance(50) ? 'my' : `${randomPerson()}'s`;
   const adjective = chance(70) ? `${randomItem(INSULT_ADJECTIVES)} ` : '';
   const noun = chance(50) ? randomItem(ALL_CLASSES) : randomItem(ANIMALS);
   const verdict = `${owner} ${adjective}${bold(noun)}`;

   return randomItem([
      `${who} is ${verdict}.`,
      `${who} is probably ${verdict}.`,
      `${who} is definitely ${verdict}.`,
      `${who} looks like ${verdict}.`,
   ]);
}
