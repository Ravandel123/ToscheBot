export interface SkillDefinition {
   name: string;
   category: 'general' | 'weapon';
}

export const SKILLS = {
   cooking: { name: 'Cooking', category: 'general' },
   fishing: { name: 'Fishing', category: 'general' },
   swimming: { name: 'Swimming', category: 'general' },
   melee: { name: 'Melee', category: 'weapon' },
   ranged: { name: 'Ranged', category: 'weapon' },
   unarmed: { name: 'Unarmed', category: 'weapon' },
} as const satisfies Record<string, SkillDefinition>;

export type SkillKey = keyof typeof SKILLS;
