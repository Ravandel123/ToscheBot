import { capitalize } from './text.js';

// Subject-aware pronoun grammar for "speak to/about someone" flavour responses.
// If the target is the speaker themselves (empty / "i" / "me" / "you"), Tosch
// addresses them in the second person ("you are amazing"); naming someone else
// switches to the third person ("Clovis is amazing"). Ported from the old
// PersonGrammar class — pure, no Discord, so any command can reuse it (love,
// resolve, rate, percent…) and it's trivially testable.

export interface PersonGrammar {
   /** Subject pronoun or name: "you" / "Clovis". */
   pronoun: string;
   /** Capitalized subject, for sentence starts: "You" / "Clovis". */
   pronounCap: string;
   /** Present "to be": "are" / "is". */
   verb: string;
   /** Past "to be": "were" / "was". */
   pastVerb: string;
   /** "to have": "have" / "has". */
   possessionVerb: string;
   /** Possessive determiner: "your" / "Clovis's". */
   determiner: string;
   /** Verb suffix used only in the third person: "" / "s" (so `look${verbS}` → "look"/"looks"). */
   verbS: string;
   /** Subject + present "to be": "you are" / "Clovis is". */
   subjectIs: string;
   /** Subject + past "to be": "you were" / "Clovis was". */
   subjectWas: string;
   /** Subject + "to have": "you have" / "Clovis has". */
   subjectHas: string;
}

// Empty or any of these (case-insensitive) means "the speaker" → second person.
const SECOND_PERSON_INPUTS = new Set(['', 'i', 'me', 'you']);

type CoreForms = Omit<PersonGrammar, 'subjectIs' | 'subjectWas' | 'subjectHas'>;

function withDerived(core: CoreForms): PersonGrammar {
   return {
      ...core,
      subjectIs: `${core.pronoun} ${core.verb}`,
      subjectWas: `${core.pronoun} ${core.pastVerb}`,
      subjectHas: `${core.pronoun} ${core.possessionVerb}`,
   };
}

/** Builds pronoun grammar for `target`. Empty / "i" / "me" / "you" → second person. */
export function personGrammar(target?: string): PersonGrammar {
   const who = (target ?? '').trim();

   if (SECOND_PERSON_INPUTS.has(who.toLowerCase()))
      return withDerived({ pronoun: 'you', pronounCap: 'You', verb: 'are', pastVerb: 'were', possessionVerb: 'have', determiner: 'your', verbS: '' });

   return withDerived({ pronoun: who, pronounCap: capitalize(who), verb: 'is', pastVerb: 'was', possessionVerb: 'has', determiner: `${who}'s`, verbS: 's' });
}
