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

   for (let i = 0; i < lower.length; i++) {
      if (/[a-z0-9]/.test(lower[i])) {
         collapsed += lower[i];
         map.push(i);
      }
   }

   return { collapsed, map };
}

/**
 * Finds the first banned term in `content`, or null. Checks the literal lowercased
 * text first, then a punctuation/space-stripped version (so `f u c k`, `f.u.c.k`,
 * and a term hidden inside a link are caught). The stripped pass can cause
 * substring false positives (e.g. a URL collapsing to contain a banned word) —
 * which is exactly why the result carries *where* and *how* it matched, so the
 * #espionage report can explain the removal.
 */
export function findBannedWord(content: string): BannedMatch | null {
   const lower = content.toLowerCase();
   const { collapsed, map } = collapseWithMap(content);

   for (const term of settings.moderation.bannedWords) {
      const literal = lower.indexOf(term);
      if (literal >= 0)
         return { term, matchedText: content.slice(literal, literal + term.length), index: literal, viaCollapsed: false };

      const collapsedTerm = stripped(term);
      const ci = collapsed.indexOf(collapsedTerm);
      if (ci >= 0) {
         const start = map[ci];
         const end = map[ci + collapsedTerm.length - 1];
         return { term, matchedText: content.slice(start, end + 1), index: start, viaCollapsed: true };
      }
   }

   return null;
}
