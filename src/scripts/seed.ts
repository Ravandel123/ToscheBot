import { accountService } from '../db/services/accountService.js';
import { characterService } from '../db/services/characterService.js';
import { CharacterLockManager } from '../core/locks.js';
import { CREATION_ATTRIBUTE_POINTS, MAX_POINTS_PER_ATTRIBUTE, emptyAllocation } from '../game/character/attributes.js';
import { BIO_MAX_LENGTH, EPITHET_MAX_LENGTH, GENDER_CHOICES, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '../game/character/identity.js';
import { defaultBody, parseBody } from '../game/character/body.js';
import { ATTRIBUTE_KEYS } from '../game/data/attributes.js';
import type { SeedCharacter } from './seed-data.js';

// The seed's pure core (D38), split out from the CLI so it never imports
// `config` and is therefore testable against an in-memory DB. `seed-characters.ts`
// is the thin runnable wrapper (env → connect → runSeed → disconnect).

export type SeedOutcome = 'created' | 'skipped';

/** The database name a Mongo connection string targets (the CLI's confirmation
 *  guard reads this — an unparseable URI is reported as such rather than thrown,
 *  since this only feeds a printed prompt, never a connection). */
export function dbNameFromUri(uri: string): string {
   try {
      const name = new URL(uri).pathname.replace(/^\//, '');
      return name || '(default)';
   } catch {
      return '(unparseable connection string)';
   }
}

/** Every problem with the roster, as human-readable lines (empty = valid).
 *  Fails LOUDLY on a bad point-buy rather than silently clamping — the file is
 *  hand-edited, so a wrong sum is a typo the owner wants surfaced. */
export function validateRoster(entries: readonly SeedCharacter[]): string[] {
   const problems: string[] = [];
   const seen = new Set<string>();

   entries.forEach((entry, index) => {
      const label = `entry #${index + 1} (${entry.name || 'unnamed'})`;

      if (!/^\d{17,20}$/.test(entry.ownerId))
         problems.push(`${label}: ownerId must be a Discord user id (17–20 digits), got '${entry.ownerId}'`);
      if (!entry.username.trim())
         problems.push(`${label}: username must not be empty`);

      const name = entry.name.trim();
      if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH)
         problems.push(`${label}: name must be ${NAME_MIN_LENGTH}–${NAME_MAX_LENGTH} characters`);
      if (!GENDER_CHOICES.some((choice) => choice.value === entry.gender))
         problems.push(`${label}: gender must be one of: ${GENDER_CHOICES.map((c) => c.value).join(', ')}`);
      if ((entry.epithet ?? '').length > EPITHET_MAX_LENGTH)
         problems.push(`${label}: epithet exceeds ${EPITHET_MAX_LENGTH} characters`);
      if ((entry.bio ?? '').length > BIO_MAX_LENGTH)
         problems.push(`${label}: bio exceeds ${BIO_MAX_LENGTH} characters`);

      let spent = 0;
      for (const key of ATTRIBUTE_KEYS) {
         const value = entry.attributes[key] ?? 0;
         if (!Number.isInteger(value) || value < 0 || value > MAX_POINTS_PER_ATTRIBUTE)
            problems.push(`${label}: attributes.${key} must be an integer in [0, ${MAX_POINTS_PER_ATTRIBUTE}], got ${value}`);
         spent += value;
      }
      if (spent !== CREATION_ATTRIBUTE_POINTS)
         problems.push(`${label}: attribute points must sum to exactly ${CREATION_ATTRIBUTE_POINTS}, got ${spent}`);

      const key = `${entry.ownerId}:${name.toLowerCase()}`;
      if (seen.has(key))
         problems.push(`${label}: duplicate entry for owner ${entry.ownerId} + name '${entry.name}'`);
      seen.add(key);
   });

   return problems;
}

/**
 * Replays ONE roster entry through the normal domain services (never a raw model
 * write): account → create draft → allocation/body → the GUARDED submit+approve
 * transitions → optional activate. Idempotent — an already-owned character with
 * the same name is skipped, so reruns are safe. The DB must be connected and the
 * roster already validated (`validateRoster`).
 */
export async function applyEntry(entry: SeedCharacter, locks: CharacterLockManager): Promise<SeedOutcome> {
   const account = await accountService.getOrCreate(entry.ownerId, entry.username);

   const owned = await characterService.getOwned(entry.ownerId);
   const name = entry.name.trim();
   if (owned.some((character) => character.identity.name.toLowerCase() === name.toLowerCase()))
      return 'skipped';

   const character = await characterService.create(entry.ownerId, {
      name,
      race: entry.race,
      gender: entry.gender,
      epithet: entry.epithet ?? '',
      bio: entry.bio ?? '',
      avatarUrl: entry.avatarUrl ?? '',
   });

   await characterService.setAttributeAllocation(character._id, entry.race, { ...emptyAllocation(), ...entry.attributes });

   if (entry.body) {
      await characterService.setBody(character._id, parseBody({
         heightCm: entry.body.heightCm?.toString(),
         weightKg: entry.body.weightKg?.toString(),
         age: entry.body.age?.toString(),
      }, defaultBody(entry.race)));
   }

   // Walk the real guarded lifecycle (draft → pending → approved) instead of
   // poking the status field, so the seed breaks visibly if the flow changes.
   if (!await characterService.submitForApproval(character._id) || !await characterService.approve(character._id))
      throw new Error(`approval transition failed for '${name}' — did the status guards change?`);

   const makeActive = entry.active ?? account.activeCharacterId === null;
   if (makeActive) {
      const result = await accountService.setActiveCharacter(entry.ownerId, entry.username, character._id, locks);
      if (!result.ok)
         throw new Error(`could not activate '${name}': ${result.reason}`);
   }

   return 'created';
}

export interface SeedReport {
   created: number;
   skipped: number;
   /** Per-entry outcome lines (in roster order) for the CLI to print. */
   lines: string[];
}

/** Applies every entry in order, collecting a printable report. Assumes the
 *  roster passed `validateRoster` and the DB is connected. */
export async function runSeed(entries: readonly SeedCharacter[], locks: CharacterLockManager): Promise<SeedReport> {
   let created = 0;
   let skipped = 0;
   const lines: string[] = [];

   for (const entry of entries) {
      const outcome = await applyEntry(entry, locks);
      if (outcome === 'created') {
         created++;
         lines.push(`✔ created '${entry.name}' (${entry.race}) for ${entry.username} [${entry.ownerId}]`);
      } else {
         skipped++;
         lines.push(`↷ skipped '${entry.name}' for ${entry.username} — already exists`);
      }
   }

   return { created, skipped, lines };
}
