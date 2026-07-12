import { expand, type Grammar } from './compose.js';
import { ADJECTIVES } from './vocabulary/adjectives.js';
import { ADVERBS } from './vocabulary/adverbs.js';
import { BEINGS } from './vocabulary/beings.js';
import { NOUNS } from './vocabulary/nouns.js';
import { VERBS } from './vocabulary/verbs.js';

// The situation-aware sentence engine: turns the tagged vocabulary into random
// but grammatical one-liners. Themes are the "situation" axis — every word class
// tags its pools by theme, `themeGrammar` collects the pools for a situation into
// plain Grammar symbols (#verb#/#being#/#noun#/#adjective#/#adverb#), and the
// pattern banks compose them with inflection modifiers. Consumers either call
// `randomSentence` for a ready-made line, or spread `themeGrammar(...)` into
// their own grammar for bespoke patterns:
//
//    expand({ ...themeGrammar(['combat']), origin: ['#being.a.capitalize# flees!'] })
//
// Known quirk (accepted): a pattern with two #being# slots may cast the same word
// twice ("a bandit corners a bandit") — rare, and it reads as comedy, not a bug.

// Grammar symbol → the vocabulary map feeding it. The single registry both types
// derive from: adding a word class = one entry here.
const WORD_CLASSES = {
   adjective: ADJECTIVES,
   adverb: ADVERBS,
   being: BEINGS,
   noun: NOUNS,
   verb: VERBS,
} as const;

type WordClasses = typeof WORD_CLASSES;

/** Any theme known to at least one word class — usable with `themeGrammar`. */
export type WordTheme = { [C in keyof WordClasses]: keyof WordClasses[C] }[keyof WordClasses];

/** Themes covered by EVERY word class (keyof a union = the shared keys) — the only ones `randomSentence` accepts. */
export type SituationTheme = keyof WordClasses[keyof WordClasses];

// Registration doubles as an exhaustiveness check: a situation theme added to the
// vocabulary but missing here (or vice versa) is a compile error.
const SITUATION_REGISTRY = { combat: true, labor: true, mystic: true, tavern: true, wilds: true } as const satisfies Record<SituationTheme, true>;

/** The live situations, e.g. for "pick a random situation" consumers. */
export const SITUATION_THEMES = Object.keys(SITUATION_REGISTRY) as readonly SituationTheme[];

// Wide view of the registry for symbol-by-symbol iteration.
const WORD_CLASS_POOLS: Record<string, Record<string, readonly string[]>> = WORD_CLASSES;

/**
 * Collects the requested themes' pools from each word class into one `Grammar`:
 * symbols `adjective`/`adverb`/`being`/`noun`/`verb`, each the merged (deduped)
 * pool across `themes`. A class with no matching theme contributes no symbol, so
 * a pattern referencing it stays visibly unexpanded (same rule as `expand`).
 */
export function themeGrammar(themes: readonly WordTheme[]): Grammar {
   const grammar: Record<string, readonly string[]> = {};

   for (const [symbol, pools] of Object.entries(WORD_CLASS_POOLS)) {
      const words = new Set(themes.flatMap((theme) => (theme in pools ? pools[theme] : [])));
      if (words.size > 0)
         grammar[symbol] = [...words];
   }

   return grammar;
}

/** Scene patterns — no external subject; a #being# carries the action. */
export const SCENE_PATTERNS = [
   '#being.a.capitalize# #adverb# #verb.third# #being.a# near the #noun#.',
   'The #adjective# #being# #verb.third# the #adjective# #being#.',
   'By the #noun#, #being.a# #adverb# #verb.third# #being.a#.',
   '#adverb.capitalize#, the #being# #verb.third# #being.a#.',
   'Word spreads of the #adjective# #being# who #verb.past# #being.a# near the #noun#.',
] as const;

/** Subject patterns — #subject# must be a third-person name ("Tosch", "the patrol"). */
export const SUBJECT_PATTERNS = [
   '#subject# #adverb# #verb.third# #being.a#.',
   '#subject# #verb.third# the #adjective# #being# near the #noun#.',
   '#adverb.capitalize#, #subject# #verb.third# #being.a#.',
   'They say #subject# #verb.past# #being.a# by the #noun#.',
] as const;

export interface SentenceOptions {
   /** Third-person subject to star in the line ("Tosch"); omitted → a scene line. */
   subject?: string;
}

/**
 * One random, grammatical, situation-flavoured sentence: a pattern from the bank
 * filled with the themes' vocabulary ("A bandit fearlessly ambushes a veteran
 * near the palisade."). With `subject`, the named party stars in it instead.
 */
export function randomSentence(themes: readonly SituationTheme[], options: SentenceOptions = {}): string {
   const { subject } = options;
   const patterns = subject ? SUBJECT_PATTERNS : SCENE_PATTERNS;

   const grammar: Record<string, readonly string[]> = { ...themeGrammar(themes), origin: patterns };
   if (subject)
      grammar.subject = [subject];

   return expand(grammar);
}
