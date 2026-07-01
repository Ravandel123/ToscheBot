import { personGrammar } from '../lib/person.js';
import { capitalize } from '../lib/text.js';
import { randomInt, randomItem } from '../lib/random.js';

// `h!love [who]` — Tosch pays a (mostly) sincere compliment. Ported from the old
// `resLove`. The flavour is a fixed pool of lines, but each must agree with ONE
// consistent subject, so this uses `personGrammar` (not the Tracery `expand`,
// which would pick a different person per token). A few lines that broke in the
// third person in the old bot ("Clovis are wearing", "Clovis inspire me") are
// fixed here via the grammar's verb/verbS forms.

const PLEASANT_SMELLS = ['a new book', 'a burning Ermehn village', 'the blood of my enemies'] as const;
// Backhanded adjectives — the compliment lands sweeter for the insult.
const BACKHANDED = ['dumb', 'fat', 'stinky', 'stupid', 'ugly'] as const;

/** One random compliment aimed at `target` (empty / "me" / "you" → second person). */
export function lovePhrase(target?: string): string {
   const p = personGrammar(target);

   const lines = [
      `I love ${p.pronoun}.`,
      `I really, really like ${p.pronoun}. Like REALLY.`,
      `${p.subjectIs} amazing!`,
      `${p.subjectIs} probably the best person in the world!`,
      `${p.pronoun} = awesome.`,
      `${p.subjectIs} the coolest person I have ever seen!`,
      `I think ${p.subjectIs} good looking, I would rate ${p.determiner} look ${randomInt(11, 20)}/10.`,
      `Even if ${p.subjectWas} cloned, ${p.pronoun} would still be one of a kind. And the better looking one.`,
      `I would love to spend every minute of every day with ${p.pronoun}, but some days I actually have to get stuff done.`,
      `${p.determiner} smile is proof that the best things in life are free.`,
      `${p.subjectIs} smarter than Felis scholars and Canid strategists combined.`,
      `I think the hardest part about being ${p.determiner} friend is pretending as though I like my other friends as much as I like ${p.pronoun}.`,
      `${p.subjectIs} not someone I pretend to not see in public.`,
      `I don't have a favourite colour, it's pretty much whatever ${p.pronoun} ${p.verb} wearing.`,
      `${p.pronoun} inspire${p.verbS} me and most likely strangers. Also, friends and stalkers. ${p.pronounCap} ${p.verb} the inspiration to many.`,
      `${p.determiner} face makes other people ugly.`,
      `If there is one thing I like about ${p.pronoun}, it is that I like more than one thing about ${p.pronoun}.`,
      `${p.subjectHas} that kind of body that when others see it they realise they need to workout more.`,
      `${p.subjectIs} more unique and wonderful than the smell of ${randomItem(PLEASANT_SMELLS)}.`,
      `Talking to ${p.pronoun} is the best part of my day, aside from when I'm killing the Ermehn and when I'm conquering the Four Kingdoms.`,
      `${p.subjectIs} awkward, in a cute way.`,
      `I'm really good at people-watching. I'm so glad I can share that hobby on ${p.pronoun}.`,
      `${p.pronoun} make${p.verbS} everything better. If people were more like ${p.pronoun} the Four Kingdoms would be perfect.`,
      `${p.subjectIs} not lazy, just that the people around ${p.pronoun} are way too active.`,
      `I love ${p.determiner} honesty and sincerity.`,
      `I would hang out with ${p.pronoun} even if ${p.pronoun} hadn't showered for a couple days.`,
      `${p.subjectHas} really good taste in friends (i.e. me).`,
      `If ${p.pronoun} cooked something really gross, I like ${p.pronoun} enough that I would tell ${p.pronoun} instead of politely eating it and hating everything.`,
      `If ${p.subjectWas} running to be the king, I would vote for ${p.pronoun}.`,
      `Our lives would be incomplete without ${p.pronoun} in it.`,
      `There's ordinary, and then there's ${p.pronoun}.`,
      `${p.subjectIs} my favourite weakness.`,
      `${p.pronoun} look${p.verbS} great for ${p.determiner} age.`,
      `I bet ${p.pronoun} taste${p.verbS} great.`,
      `${p.subjectIs} beautiful... On the inside.`,
      `I love ${randomItem(BACKHANDED)} people like ${p.pronoun}!`,
      `I love how ${randomItem(BACKHANDED)} ${p.subjectIs}.`,
      `Usually ${randomItem(BACKHANDED)} people disgust me, but ${p.subjectIs} actually cute.`,
      `I don't care what everyone else says. I don't think ${p.subjectIs} that bad.`,
   ];

   return capitalize(randomItem(lines));
}
