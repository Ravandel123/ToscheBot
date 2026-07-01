export const bold = (text: string): string => `**${text}**`;
export const italic = (text: string): string => `*${text}*`;
export const underline = (text: string): string => `__${text}__`;

export function capitalize(text: string): string {
   return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

const isVowel = (letter: string): boolean => 'aeiouy'.includes(letter.toLowerCase());

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
   speak: 'spoke', stand: 'stood', steal: 'stole', swim: 'swam', take: 'took',
   teach: 'taught', tell: 'told', think: 'thought', throw: 'threw',
   understand: 'understood', wake: 'woke', wear: 'wore', win: 'won', write: 'wrote',
};

/**
 * Best-effort English past tense of a verb (irregular table first, then the regular
 * spelling rules: consonant-doubling for CVC monosyllables, y→ied, silent-e→d, …).
 * A heuristic for flavour — also wired into grammars as the `#verb.past#` modifier.
 */
export function pastTense(verb: string): string {
   const irregular = IRREGULAR_PAST[verb.toLowerCase()];
   if (irregular)
      return irregular;

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
