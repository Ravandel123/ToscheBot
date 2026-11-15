export interface CurrencyDefinition {
   name: string;
   emoji: string;
}

// ONE currency until the economy layer exists. The lore has per-race
// regional currencies (amber drops, pearl flakes, obsidian chips…) — they
// return WITH an exchange mechanic (Ruleset/economy.md), not before:
// adding a currency later is one appended line here; removing one after
// players hold balances is a migration.
export const CURRENCIES = {
   deltradaCoins: { name: 'Deltrada Coins', emoji: '🪙' },
} as const satisfies Record<string, CurrencyDefinition>;

export type CurrencyKey = keyof typeof CURRENCIES;
