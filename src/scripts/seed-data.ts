import type { AttributeKey } from '../game/data/attributes.js';
import type { RaceId } from '../game/data/races.js';
import type { GENDER_CHOICES } from '../game/character/identity.js';

// HAND-MAINTAINED alpha roster (owner-edited). `npm run seed` replays every
// entry through the normal creation services (accountService/characterService),
// so after a DB wipe the players get their characters back without redoing the
// wizard. Entries record only what the player TYPED INTO THE WIZARD — everything
// else (resources, currencies, progression, inventory…) is derived from the
// current catalogs at seed time, exactly like a fresh `/character create`.
//
// MAINTENANCE RULE (for future sessions — see CLAUDE.md D38): because the seed
// derives instead of copying, most schema/catalog changes need NO edit here.
// You MUST extend `SeedCharacter` + `seed-characters.ts` in the same commit
// whenever the CREATION INPUT shape changes: a new required wizard step, a
// changed identity field, or changed point-buy rules (CREATION_ATTRIBUTE_POINTS
// / MAX_POINTS_PER_ATTRIBUTE). Never store derived stats in this file.
//
// Adding an entry: copy the template below into SEED_CHARACTERS and fill it in.
// Rerunning `npm run seed` is safe — existing owner+name pairs are skipped.

export interface SeedCharacter {
   /** Discord user id of the owner (right-click the user → Copy User ID). */
   ownerId: string;
   /** Username cached on the account (refreshed on the player's next interaction). */
   username: string;
   name: string;
   race: RaceId;
   gender: (typeof GENDER_CHOICES)[number]['value'];
   epithet?: string;
   /** Short description, ≤ 1000 chars. */
   bio?: string;
   avatarUrl?: string;
   /** Creation point-buy on top of the racial base: values must sum to exactly
    *  CREATION_ATTRIBUTE_POINTS (50), max MAX_POINTS_PER_ATTRIBUTE (20) each.
    *  Omitted attributes get 0. */
   attributes: Partial<Record<AttributeKey, number>>;
   /** Physical frame (metric). Omit any field to keep the race's default. */
   body?: { heightCm?: number; weightKg?: number; age?: number };
   /** Make this the account's active character. Default: yes if the account has
    *  no active character yet (so the first entry per account wins). */
   active?: boolean;
}

export const SEED_CHARACTERS: SeedCharacter[] = [
   // TEMPLATE — copy, uncomment, fill in:
   // {
   //    ownerId: '000000000000000000',
   //    username: 'Player',
   //    name: 'Character Name',
   //    race: 'tamian',
   //    gender: 'male',
   //    epithet: 'the Example',
   //    bio: 'A short in-character description.',
   //    attributes: { strength: 10, constitution: 10, agility: 10, willpower: 10, perception: 10 },
   //    body: { heightCm: 100, weightKg: 30, age: 25 },
   // },
];
