import { capitalize } from '../lib/text.js';

// English morphology — generic language MECHANICS, no flavour content. The words
// themselves live in grammar/vocabulary/; Tracery-style composition in compose.ts.
// Everything here is a best-effort heuristic: irregular tables first, then the
// common spelling rules. Good enough for flavour text, not linguistically exact.

const isVowel = (letter: string): boolean => 'aeiouy'.includes(letter.toLowerCase());

/** Ends in a sibilant that takes "-es" ("class" → "classes", "fox" → "foxes"). */
const takesEs = (word: string): boolean => /(?:s|x|z|ch|sh)$/.test(word);

/** Re-applies a leading capital after a table lookup ("Wolf" → "Wolves"). */
const matchLeadingCase = (source: string, result: string): string =>
   /^[A-Z]/.test(source) ? capitalize(result) : result;

/**
 * Rough English syllable count (a heuristic ported from the old bot — good enough
 * for flavour, not linguistically exact). Returns 0 when it finds no vowel groups.
 */
export function countSyllables(word: string): number {
   let stem = word.toLowerCase();
   let extra = 0;

   if (stem.length > 3 && stem.startsWith('some')) {
      stem = stem.slice(4);
      extra++;
   }

   stem = stem.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '').replace(/^y/, '');

   const groups = stem.match(/[aeiouy]{1,2}/g);
   return (groups ? groups.length : 0) + extra;
}

// Verb prefixes that keep the base verb's irregular forms and stress ("outrun" →
// "outran"/"outrunning"). Only consulted after a direct table miss.
const VERB_PREFIXES = ['fore', 'mis', 'out', 'over', 're', 'un'] as const;

/** Splits a known verb prefix ("out|run") so irregular/doubling rules can reach the base. */
function splitVerbPrefix(verb: string): { prefix: string; base: string } | null {
   const lower = verb.toLowerCase();

   for (const prefix of VERB_PREFIXES)
      if (lower.startsWith(prefix) && lower.length - prefix.length >= 2)
         return { prefix: verb.slice(0, prefix.length), base: verb.slice(prefix.length) };

   return null;
}

// A small table of common irregular verbs (base → simple past). Enough for flavour;
// everything else falls through to the regular-spelling rules below.
const IRREGULAR_PAST: Record<string, string> = {
   be: 'was', begin: 'began', break: 'broke', bring: 'brought', build: 'built',
   buy: 'bought', catch: 'caught', come: 'came', do: 'did', draw: 'drew',
   drink: 'drank', drive: 'drove', eat: 'ate', fall: 'fell', feel: 'felt',
   find: 'found', fly: 'flew', get: 'got', give: 'gave', go: 'went',
   grow: 'grew', have: 'had', hear: 'heard', hold: 'held', keep: 'kept',
   know: 'knew', leave: 'left', lose: 'lost', make: 'made', meet: 'met',
   pay: 'paid', read: 'read', run: 'ran', say: 'said', see: 'saw',
   sell: 'sold', send: 'sent', sing: 'sang', sit: 'sat', sleep: 'slept',
   smite: 'smote', speak: 'spoke', stand: 'stood', steal: 'stole', strike: 'struck',
   swim: 'swam', take: 'took', teach: 'taught', tell: 'told', think: 'thought',
   throw: 'threw', understand: 'understood', wake: 'woke', wear: 'wore',
   win: 'won', write: 'wrote',
};

/**
 * Best-effort English past tense of a verb (irregular table first — including
 * prefixed compounds like "outrun" → "outran" — then the regular spelling rules:
 * consonant-doubling for CVC monosyllables, y→ied, silent-e→d, …). A heuristic
 * for flavour — also wired into grammars as the `#verb.past#` modifier.
 */
export function pastTense(verb: string): string {
   const irregular = IRREGULAR_PAST[verb.toLowerCase()];
   if (irregular)
      return matchLeadingCase(verb, irregular);

   const split = splitVerbPrefix(verb);
   if (split) {
      const irregularBase = IRREGULAR_PAST[split.base.toLowerCase()];
      if (irregularBase)
         return `${split.prefix}${irregularBase}`;
   }

   if (verb.length < 3)
      return `${verb}ed`;

   const last = verb[verb.length - 1].toLowerCase();
   const secondLast = verb[verb.length - 2];
   const thirdLast = verb[verb.length - 3];

   // CVC monosyllable (e.g. "stop" → "stopped"), but not -w/-x/-y.
   if (countSyllables(verb) === 1 && !isVowel(last) && isVowel(secondLast) && !isVowel(thirdLast) && !'wxy'.includes(last))
      return `${verb}${last}ed`;

   if (last === 'y' && !isVowel(secondLast))
      return `${verb.slice(0, -1)}ied`;

   if (last === 'c')
      return `${verb}ked`;

   if (last === 'e')
      return `${verb}d`;

   return `${verb}ed`;
}

const IRREGULAR_THIRD: Record<string, string> = { be: 'is', do: 'does', go: 'goes', have: 'has' };

/**
 * Third-person-singular present of a verb: "smite" → "smites", "catch" →
 * "catches", "harry" → "harries", "have" → "has". The `#verb.third#` modifier.
 */
export function thirdPerson(verb: string): string {
   const irregular = IRREGULAR_THIRD[verb.toLowerCase()];
   if (irregular)
      return matchLeadingCase(verb, irregular);

   const split = splitVerbPrefix(verb);
   if (split) {
      const irregularBase = IRREGULAR_THIRD[split.base.toLowerCase()];
      if (irregularBase)
         return `${split.prefix}${irregularBase}`;
   }

   const lower = verb.toLowerCase();

   if (takesEs(lower))
      return `${verb}es`;

   if (lower.endsWith('y') && verb.length > 1 && !isVowel(verb[verb.length - 2]))
      return `${verb.slice(0, -1)}ies`;

   if (lower.endsWith('o'))
      return `${verb}es`;

   return `${verb}s`;
}

/**
 * Present participle / gerund of a verb: "run" → "running", "make" → "making",
 * "die" → "dying", "see" → "seeing". The `#verb.ing#` modifier.
 */
export function gerund(verb: string): string {
   const lower = verb.toLowerCase();

   if (lower.endsWith('ie'))
      return `${verb.slice(0, -2)}ying`;

   // Drop a silent final e ("make" → "making") but keep -ee/-oe/-ye ("see" →
   // "seeing") and leave "be" alone ("being").
   if (lower.endsWith('e') && !/[eoy]e$/.test(lower) && lower !== 'be')
      return `${verb.slice(0, -1)}ing`;

   const split = splitVerbPrefix(verb);
   if (split)
      return `${split.prefix}${gerund(split.base)}`;

   if (verb.length >= 3) {
      const last = verb[verb.length - 1].toLowerCase();
      const secondLast = verb[verb.length - 2];
      const thirdLast = verb[verb.length - 3];

      // CVC monosyllable doubles ("run" → "running"), but not -w/-x/-y.
      if (countSyllables(verb) === 1 && !isVowel(last) && isVowel(secondLast) && !isVowel(thirdLast) && !'wxy'.includes(last))
         return `${verb}${last}ing`;
   }

   return `${verb}ing`;
}

// Irregular noun plurals (and invariants like "sheep"). Multi-word nouns recurse
// onto their last word, so "mountain wolf" → "mountain wolves" for free.
const IRREGULAR_PLURAL: Record<string, string> = {
   calf: 'calves', child: 'children', deer: 'deer', die: 'dice', elk: 'elk',
   fish: 'fish', foot: 'feet', goose: 'geese', half: 'halves', hoof: 'hooves',
   knife: 'knives', leaf: 'leaves', life: 'lives', loaf: 'loaves', man: 'men',
   moose: 'moose', mouse: 'mice', ox: 'oxen', person: 'people', scarf: 'scarves',
   sheep: 'sheep', shelf: 'shelves', thief: 'thieves', tooth: 'teeth',
   wife: 'wives', wolf: 'wolves', woman: 'women',
};

// Common -o nouns that take -es; the rest ("photo", "piano") just take -s.
const O_TAKES_ES = new Set(['echo', 'hero', 'potato', 'tomato', 'torpedo', 'veto']);

/**
 * Best-effort English plural of a noun: irregulars ("wolf" → "wolves"), sibilant
 * -es ("class" → "classes"), consonant-y → -ies ("story" → "stories"), common
 * -o → -es ("hero" → "heroes"), else -s. The `#noun.s#` modifier.
 */
export function pluralize(noun: string): string {
   const spaceAt = noun.lastIndexOf(' ');
   if (spaceAt !== -1)
      return `${noun.slice(0, spaceAt + 1)}${pluralize(noun.slice(spaceAt + 1))}`;

   const lower = noun.toLowerCase();

   const irregular = IRREGULAR_PLURAL[lower];
   if (irregular)
      return matchLeadingCase(noun, irregular);

   if (takesEs(lower))
      return `${noun}es`;

   if (lower.endsWith('y') && noun.length > 1 && !isVowel(noun[noun.length - 2]))
      return `${noun.slice(0, -1)}ies`;

   if (lower.endsWith('o') && O_TAKES_ES.has(lower))
      return `${noun}es`;

   return `${noun}s`;
}

// "a"/"an" exceptions, ported from the old dataSpeech tables. Kept here as generic
// English mechanics (not flavour content): words that look vowel-led but take "a"
// ("a unicorn"), silent-h words that take "an" ("an honour"), and uncountable
// nouns that take no article at all ("water", not "a water").
const ARTICLE_A = new Set(['eulogy', 'one', 'unicorn', 'union', 'united', 'university', 'used', 'user']);
const ARTICLE_AN = new Set(['honor', 'honorable', 'honour', 'honourable', 'heir', 'hourglass']);
const UNCOUNTABLE = new Set([
   'advice', 'art', 'baseball', 'biology', 'butter', 'coffee', 'computer science', 'currency', 'electricity',
   'furniture', 'gas', 'happiness', 'history', 'hockey', 'information', 'love', 'luggage', 'mathematics',
   'money', 'music', 'news', 'power', 'rice', 'scenery', 'sugar', 'tennis', 'travel', 'volleyball', 'water', 'work',
]);

/**
 * The indefinite article for `word`: `'a'`, `'an'`, or `''` for an uncountable noun
 * (which takes none). Handles the common exceptions; falls back to leading-vowel.
 * Article agreement is decided by the first word of a phrase.
 */
export function indefiniteArticle(word: string): 'a' | 'an' | '' {
   const phrase = word.trim().toLowerCase();
   if (UNCOUNTABLE.has(phrase))
      return '';

   const first = phrase.split(/\s+/)[0] ?? '';
   if (ARTICLE_A.has(first))
      return 'a';
   if (ARTICLE_AN.has(first))
      return 'an';

   return /^[aeiou]/.test(first) ? 'an' : 'a';
}
