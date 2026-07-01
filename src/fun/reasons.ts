import { chance, randomItem } from '../lib/random.js';
import { bold } from '../lib/text.js';
import { funnyEnding } from './flavor.js';

// `h!how` / `h!why` — Tosch explains anything with a confidently absurd cause. Ported
// from the old how/why switch cases (their solo/dual lists merged + de-duped here).
// A "reason" is either a single noun-phrase, or a composed "the Adjective Noun".

const SOLO = [
   'Abduction', 'Acid', 'Animal Abuse', 'the Art', 'an Atomic Bomb', 'a Ballista', 'Bandits', 'a Battering Ram',
   'the Booze', 'Brainwashing', 'C4', 'a Catapult', 'Chloroform', 'Cloning', 'the Coconut', 'Communism',
   'Darkness', 'Delight', 'Despair', 'Destruction', 'Doom', 'the Drugs', 'the Dung', 'a Duplication Device',
   'Electroshock Therapy', 'Evil', 'Famine', 'Food', 'Fun', 'Fury', 'Gambling', 'Garbage', 'Good', 'Honor',
   'Hunger', 'Immorality', 'Immortality', 'Justice', 'Kidnapping', 'Lobotomy', 'Madness', 'Me', 'Mercy',
   'the Money', 'the Music', 'a Nuclear Missile', 'the Nut', 'Nuts', 'Pleasure', 'Power', 'Ravandel',
   'Retribution', 'the Rot', 'the Rumors', 'Seismic Activity', 'Shadows', 'Starvation', 'a Trebuchet',
   'a Troglodyte', 'Ugliness', 'Uselessness', 'Violence', 'War', 'the Weed', 'Whipping in the Abbey',
] as const;

const ADJECTIVES = [
   'Abominable', 'Adorable', 'Aggressive', 'Anointed', 'Awesome', 'Awful', 'Black', 'Bloody', 'Brutal',
   'Cannibalistic', 'Celestial', 'Dark', 'Degenerate', 'Destructive', 'Evil', 'Faceless', 'Furious', 'Furry',
   'Honorable', 'Hungry', 'Immortal', 'Immoral', 'Insane', 'Lunar', 'Mad', 'Maniacal', 'Masochistic', 'Mindless',
   'Nutty', 'Pessimistic', 'Primitive', 'Psychopathic', 'Rotten', 'Sacred', 'Sadistic', 'Smart', 'Strong',
   'Suicidal', 'Vengeful', 'Violent', 'Useless',
] as const;

const NOUNS = [
   'Bandits', 'Beef', 'Booze', 'Brain', 'Cannibals', 'Coconuts', 'Cult', 'Darkness', 'Delight', 'Delusion',
   'Destruction', 'Doom', 'Drugs', 'Dung', 'Fear', 'Fools', 'Furries', 'Fury', 'Ghost', 'Hand', 'Honor',
   'Intellect', 'Justice', 'Light', 'Madness', 'Maniac', 'Mask', 'Masochism', 'Mercy', 'Money', 'Moon', 'Mutant',
   'Nuts', 'Pleasure', 'Power', 'Psychopath', 'Retribution', 'Rot', 'Sadism', 'Troll', 'Vengeance', 'Violence',
   'War', 'Weed', 'Whipping',
] as const;

const WHY_RARE = [
   'Because I say so.', 'Because you are a noob, lol.', 'Because those are orders from the Imperator.',
   "You won't grasp my answer with such a low IQ anyway, so I won't bother explaining.",
   'Your small mind is unable to comprehend that.',
] as const;

/** The bolded reason core: a solo phrase 60% of the time, else a composed "the Adjective Noun". */
export function reasonCore(): string {
   if (chance(60))
      return bold(randomItem(SOLO));

   const adjective = randomItem(ADJECTIVES);
   return `the ${bold(`${adjective} ${randomItem(NOUNS)}`)}`;
}

/** A made-up answer to "how?": "By using the Coconut." */
export function howAnswer(): string {
   const reason = reasonCore();
   return randomItem([
      `By using ${reason}`,
      `Definitely with the help of ${reason}`,
      `I think ${reason} is the answer`,
      `Answer = ${reason}`,
   ]) + funnyEnding();
}

/** A made-up answer to "why?": "Because of the Furry Fury." 15% of the time, pure attitude. */
export function whyAnswer(): string {
   if (chance(15))
      return randomItem(WHY_RARE);

   const reason = reasonCore();
   return randomItem([
      `Because of ${reason}`,
      `It's caused by ${reason}`,
      `The reason is clear — ${reason}`,
   ]) + funnyEnding();
}
