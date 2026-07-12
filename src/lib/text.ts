// Discord-markdown and plain string formatting helpers. English language
// mechanics (articles, tenses, plurals, syllables) live in grammar/inflect.ts;
// this file is only about decorating text.

export const bold = (text: string): string => `**${text}**`;
export const italic = (text: string): string => `*${text}*`;
export const underline = (text: string): string => `__${text}__`;

export function capitalize(text: string): string {
   return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}
