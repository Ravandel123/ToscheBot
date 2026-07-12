import { chance, randomItem } from '../lib/random.js';
import { capitalize } from '../lib/text.js';
import type { PersonGrammar } from '../lib/person.js';
import { ADJECTIVES } from '../grammar/vocabulary/adjectives.js';

// `h!resolve [who]` — a Darkest-Dungeon-style resolve check: usually an affliction,
// occasionally a virtue. Ported from the old `resResolve`. The old bot used custom
// server emojis by hardcoded id (`<:Stress:554…>`) — those belonged to a different
// guild, so we use unicode here (swap to Deltrada custom emojis via settings later).
// Subject agreement comes from personGrammar (old "you is" → "you are").

export const RESOLVE_EMOJI = { affliction: '😰', virtue: '✨' } as const;

/** The verdict line, e.g. "You are **Paranoid 😰**" / "Tosche is **Mighty ✨**". */
export function resolveVerdict(person: PersonGrammar): string {
   const afflicted = chance(75);
   const trait = capitalize(randomItem(afflicted ? ADJECTIVES.affliction : ADJECTIVES.virtue));
   const emoji = afflicted ? RESOLVE_EMOJI.affliction : RESOLVE_EMOJI.virtue;

   return `${capitalize(person.subjectIs)} **${trait} ${emoji}**`;
}
