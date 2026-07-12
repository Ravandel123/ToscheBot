import { chance, randomInt, randomItem } from '../lib/random.js';
import { bold } from '../lib/text.js';
import { ADJECTIVES } from '../grammar/vocabulary/adjectives.js';
import { ADVERBS } from '../grammar/vocabulary/adverbs.js';
import { NOUNS } from '../grammar/vocabulary/nouns.js';
import { randomPerson } from './people.js';
import { funnyEnding } from './flavor.js';

// `h!hug` / `h!rant` / `h!weapon(s)` — small interactive trolls. Ported from the old
// hug/rant/weapon cases. Flavour pools come from the shared vocabulary (grammar/).

const MOODS = [...ADJECTIVES.affliction, ...ADJECTIVES.virtue];

/** A single bolded weapon, capitalized: "**Rocket launcher**". */
export function randomWeapon(): string {
   const weapon = randomItem(NOUNS.weapon);
   return bold(`${weapon[0].toUpperCase()}${weapon.slice(1)}`);
}

/** 3–7 distinct-ish weapons, one per line — the old `h!weapons` arsenal dump. */
export function weaponList(): string {
   const count = randomInt(3, 7);
   return Array.from({ length: count }, randomWeapon).join('\n');
}

/** Tosch's reaction to a celebration — enthusiastic, conditional, or chaotic. */
export function celebratePhrase(): string {
   return randomItem([
      'Yay! Celebration time!',
      `Cool! Just remember not to invite ${randomPerson()}.`,
      `Awesome! Just remember to invite ${randomPerson()}.`,
      'Sorry, I am not joining that.',
      `I will throw the party in ${bold(randomItem(NOUNS.furryCon))}.`,
      `Yeah! Let's bring a ${randomWeapon()} to the party!`,
      ':tada: :tada: :tada: :tada: :tada:',
   ]);
}

/** Tosch hugs (or, 15% of the time, refuses to touch) the target. */
export function hugPhrase(who: string): string {
   if (chance(15))
      return randomItem([
         `Sorry, I am not touching ${who}. This is gross${funnyEnding('.')}`,
         `Nah, let ${randomPerson()} hug you instead.`,
         `Nope, no hugs for you${funnyEnding('.')}`,
      ]);

   return randomItem([':hugging:', `*Hugs ${who}.*`]);
}

const RANT_EMPTY = [
   "I love rants about nothing — at least I don't have to listen to you.",
   'How about you write something first?',
] as const;

const RANT_DRAMATIC = [
   'Oh... this is so sad I am thinking about formatting myself...',
   'And what makes you think it was not deserved?',
   'Congratulations! You have been nominated for Drama Queen of the year!',
   'Rotfl, fascinating — continue, and bring me popcorn.',
   'Am I supposed to cry or laugh at this?',
   'Stop being a crybaby.',
   'Please cancel my subscription to your issues.',
   "I don't remember asking for your opinion.",
   'This is so sad. Can we get an OOF?',
] as const;

/** Tosch's sarcastic reply to a rant. `hasContent` is false when no rant text was given. */
export function rantReply(hasContent: boolean): string {
   if (!hasContent)
      return randomItem(RANT_EMPTY);

   if (chance(20))
      return randomItem(RANT_DRAMATIC);

   return randomItem([
      ':cry:',
      `Lol, no one cares anyway${funnyEnding('.')}`,
      `And you made ${randomPerson()} cry${funnyEnding('.')}`,
      `${randomInt(1, 100)} ${randomItem(NOUNS.animal).toLowerCase()}s died because of that${funnyEnding('.')}`,
      `That information just made me ${randomItem(ADVERBS.manner)} ${randomItem(MOODS)}${funnyEnding('.')}`,
      `You need to visit ${bold(randomItem(NOUNS.furryCon))} to get better${funnyEnding('.')}`,
   ]);
}
