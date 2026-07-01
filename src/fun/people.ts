import { chance, randomItem } from '../lib/random.js';

// Server regulars and special targets. Edit these as the friend group changes.
export const PEOPLE_IRL = ['Dinly', 'Lanaar', 'Me', 'Ravandel', 'Catz', 'You', 'Nachtkind', 'Alban', 'Storyteller', 'Chini'] as const;
export const PEOPLE_SPECIAL = ['Everybody', 'Nobody'] as const;

// Beyond the Western Deep characters.
export const PEOPLE_BWD = [
   'Asha', 'Ashtor', 'Beck', 'Bevan', 'Cain', 'Clovis', 'Crim', 'Dakkan', 'Eira', 'Hardin', 'Janik', 'Kenosh',
   'Mitra', 'Quinlan', 'Rathik', 'Rhosyn', 'Rook', 'Sigrid', 'Theo', 'Tosch', 'Tosche', 'Yurk',
] as const;

export const PEOPLE_BAD_GUYS = ['Clovis', 'Darth Vader', 'Hannibal Lecter', 'Saruman', 'Sauron', 'Tosch', 'Tosche', 'Voldemort'] as const;

const PEOPLE_IRL_ONLY = [...PEOPLE_IRL, ...PEOPLE_SPECIAL];
const PEOPLE_ALL = [...PEOPLE_IRL, ...PEOPLE_SPECIAL, ...PEOPLE_BWD, ...PEOPLE_BAD_GUYS];

/** Mostly picks a server regular; occasionally reaches for a fictional name. */
export function randomPerson(): string {
   return chance(75) ? randomItem(PEOPLE_IRL_ONLY) : randomItem(PEOPLE_ALL);
}
