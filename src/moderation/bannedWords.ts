import { settings } from '../settings.js';

const stripped = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface BannedMatch {
   /** The banned-list entry that matched. */
   term: string;
   /** The exact slice of the original content that matched (may span punctuation for an evaded hit). */
   matchedText: string;
   /** Where `matchedText` starts in the original content. */
   index: number;
   /** True when it only matched after stripping spaces/punctuation (e.g. inside a link, or spaced out). */
   viaCollapsed: boolean;
}

// Builds the lowercased, punctuation/space-stripped text AND a map from each
// stripped-char position back to its index in the original — so a hit in the
// stripped text can be pinpointed in the message the user actually typed.
function collapseWithMap(content: string): { collapsed: string; map: number[] } {
   const lower = content.toLowerCase();
   let collapsed = '';
   const map: number[] = [];

   for (let i = 0; i < lower.length; i++)
      if (/[a-z0-9]/.test(lower[i])) {
         collapsed += lower[i];
         map.push(i);
      }

   return { collapsed, map };
}

// A match must START at a word boundary in the original text ('cunt' must not
// fire inside "Scunthorpe"). The END is deliberately unanchored: several list
// entries are stems that must catch inflections ('kurw' → "kurwa", "kurwy").
const isWordChar = (char: string | undefined): boolean => !!char && /[a-z0-9]/i.test(char);

function findLiteralIndex(lower: string, term: string): number {
   for (let index = lower.indexOf(term); index >= 0; index = lower.indexOf(term, index + 1))
      if (!isWordChar(lower[index - 1]))
         return index;

   return -1;
}

/**
 * Finds the first banned term in `content`, or null. Checks the literal lowercased
 * text first, then a punctuation/space-stripped version (so `f u c k`, `f.u.c.k`,
 * and a term hidden inside a link are caught). Both passes require the hit to
 * start at a word boundary of the *original* text; the stripped pass can still
 * cause false positives (words fused across removed punctuation) — which is
 * exactly why the result carries *where* and *how* it matched, so the
 * #espionage report can explain the removal.
 *
 * `terms` defaults to the live settings list; tests inject their own.
 */
export function findBannedWord(content: string, terms: readonly string[] = settings.moderation.bannedWords): BannedMatch | null {
   const lower = content.toLowerCase();
   const { collapsed, map } = collapseWithMap(content);

   for (const term of terms) {
      const literal = findLiteralIndex(lower, term);
      if (literal >= 0)
         return { term, matchedText: content.slice(literal, literal + term.length), index: literal, viaCollapsed: false };

      const collapsedTerm = stripped(term);
      for (let ci = collapsed.indexOf(collapsedTerm); ci >= 0; ci = collapsed.indexOf(collapsedTerm, ci + 1)) {
         const start = map[ci];
         if (isWordChar(content[start - 1]))
            continue; // fused mid-word in the original ("bad ick") — not a hit

         const end = map[ci + collapsedTerm.length - 1];
         return { term, matchedText: content.slice(start, end + 1), index: start, viaCollapsed: true };
      }
   }

   return null;
}
