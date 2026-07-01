import { randomItem } from './random.js';
import { indefiniteArticle, pastTense } from './text.js';

// A tiny Tracery-style text composer. A "grammar" is plain data: each symbol maps
// to a list of rules. `expand` replaces every `#symbol#` with a random rule for
// that symbol, recursively (a rule may reference more symbols) — so one small
// grammar yields huge variety, and the boring "pick one of N fixed lines" becomes
// "compose from interchangeable parts". Grammars are just objects, so they're
// reusable and **combinable** (merge with `{ ...a, ...b }`, or inject runtime
// symbols like a freshly computed number). Optional modifier: `#symbol.mod#`
// post-processes the expansion (`capitalize` / `a` for a-an / `s` for plural /
// `past` for past tense).

export type Grammar = Record<string, readonly string[]>;

type Modifier = (value: string) => string;

const MODIFIERS: Record<string, Modifier> = {
   capitalize: (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s),
   a: (s) => { const article = indefiniteArticle(s); return article ? `${article} ${s}` : s; }, // a/an (+ exceptions)
   s: (s) => `${s}s`, // naive plural
   past: (s) => pastTense(s), // past tense, e.g. #verb.past#
};

const TOKEN = /#(\w+)(?:\.(\w+))?#/g;
const MAX_DEPTH = 50; // guard against a grammar that references itself forever

/**
 * Expands `template` against `grammar`: every `#symbol#` becomes a random rule for
 * that symbol, expanded recursively. An unknown symbol is left as `#symbol#` (a
 * visible hint that you mistyped it, rather than a silent gap). Defaults to the
 * `#origin#` symbol as the entry point.
 */
export function expand(grammar: Grammar, template = '#origin#', depth = 0): string {
   if (depth > MAX_DEPTH)
      return template;

   return template.replace(TOKEN, (match: string, symbol: string, modifier?: string) => {
      const rules = grammar[symbol];
      if (!rules || rules.length === 0)
         return match; // leave it visible instead of dropping it

      let value = expand(grammar, randomItem(rules), depth + 1);
      if (modifier && modifier in MODIFIERS)
         value = MODIFIERS[modifier](value);

      return value;
   });
}
