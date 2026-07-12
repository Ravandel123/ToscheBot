import { chance, randomInt, randomItem } from '../lib/random.js';
import { bold } from '../lib/text.js';
import { NOUNS } from '../grammar/vocabulary/nouns.js';
import { randomPerson } from './people.js';
import { randomWeapon } from './reactions.js';
import { funnyEnding } from './flavor.js';

// `h!advice` — Tosch's appalling life coaching. This is the old `h!help` *troll*
// (fake therapy), kept under a name that won't shadow the real `h!help`. The static
// quips carry the joke; a few dynamic lines reuse the shared pools.

const STATIC_ADVICE = [
   'I think you should visit a doctor.',
   'Ravandel is the specialist you want to talk to about your problems.',
   'Electroshock therapy will work wonders for you.',
   'I would advise a lobotomy.',
   'Chill and eat something good.',
   'I think you need plastic surgery.',
   'I suggest a whipping session in the abbey.',
   "Don't worry, be happy!",
   'Stop wasting your time on advice commands and do something with your miserable life.',
   'Read a book.',
   'Draw something.',
   'Praying to God might be a good idea in your situation.',
   'Educate yourself.',
   'Take out the trash — your home looks like a garbage dump.',
   'Go into the woods and try to find a Yeti.',
   'Tell your bullies they are hurting you.',
   'There are bigger problems than your sadness.',
   "Don't trust anyone.",
   'Get new friends.',
   'Just let it go.',
   'If you feel alone, watch a horror movie before bed. You will not feel alone anymore.',
   'No flashlight on your phone? Take a photo of the sun, and use it in the dark.',
   'No ice for drinks? Use frozen vegetables.',
   'Having a bad day? Wear sunglasses. Now you are having a bad evening.',
   'A glove filled with warm water creates the illusion that you are not alone.',
] as const;

const ACTION_VERBS = ['Buy', 'Draw', 'Feed', 'Observe', 'Pet', 'Sketch'] as const;
const MEALS = ['soup', 'stew', 'fish', 'bread', 'porridge', 'pie'] as const;
const SIZES = ['tiny', 'small', 'average', 'big', 'enormous'] as const;

function dynamicAdvice(): string {
   return randomItem([
      `You should take a trip to ${bold(randomItem(NOUNS.furryCon))}${funnyEnding('.')}`,
      `Learn how to use a ${randomWeapon()}${funnyEnding('.')}`,
      `${randomItem(ACTION_VERBS)} a ${randomItem(NOUNS.animal)}${funnyEnding('.')}`,
      `Go outside for ${randomInt(1, 12)} hours${funnyEnding('.')}`,
      `Have you tried going to ${bold(randomItem(NOUNS.furryCon))} and using a ${randomWeapon()}?`,
      `Eat ${randomItem(SIZES)} ${randomItem(MEALS)}${funnyEnding('.')}`,
      `I think you should talk to ${bold(randomPerson())}${funnyEnding('.')}`,
   ]);
}

/** A piece of (terrible) advice — a static quip 10% of the time, else a generated one. */
export function advicePhrase(): string {
   return chance(10) ? randomItem(STATIC_ADVICE) : dynamicAdvice();
}
