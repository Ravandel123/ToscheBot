export interface CurrencyDefinition {
   name: string;
   emoji: string;
}

export const CURRENCIES = {
   amberDrops: { name: 'Amber Drops', emoji: '🟠' },
   pearlFlakes: { name: 'Pearl Flakes', emoji: '⚪' },
   obsidianChips: { name: 'Obsidian Chips', emoji: '⚫' },
   silverCoins: { name: 'Silver Coins', emoji: '🥈' },
   goldCoins: { name: 'Gold Coins', emoji: '🥇' },
   deltradaCoins: { name: 'Deltrada Coins', emoji: '🪙' },
} as const satisfies Record<string, CurrencyDefinition>;

export type CurrencyKey = keyof typeof CURRENCIES;
