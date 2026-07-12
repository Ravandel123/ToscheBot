// Being pools — nouns for ACTORS: creatures and folk that can act or be acted on.
// The default sentence patterns cast #being# as both subject and object, so every
// entry must read naturally doing things AND having things done to it. Contract:
// singular, lowercase (mid-sentence), article-friendly ("a bandit", "an elk").
// Scene props that only get stood next to belong in nouns.ts instead.

export const BEINGS = {
   combat: ['bandit', 'brawler', 'deserter', 'mercenary', 'raider', 'sellsword', 'skirmisher', 'veteran'],
   labor: ['apprentice', 'blacksmith', 'carpenter', 'farmhand', 'mason', 'miller', 'porter', 'weaver'],
   mystic: ['apparition', 'oracle', 'seer', 'soothsayer', 'stargazer', 'wanderer', 'witch'],
   tavern: ['barkeep', 'gambler', 'merchant', 'minstrel', 'patron', 'reveler', 'storyteller', 'traveler'],
   wilds: ['elk', 'forager', 'hermit', 'hunter', 'poacher', 'stag', 'trapper', 'wolf'],
} as const satisfies Record<string, readonly string[]>;

export type BeingTheme = keyof typeof BEINGS;
