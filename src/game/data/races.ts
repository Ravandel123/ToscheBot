// The seven anthropomorphic races of Dunia (BtWD). Flavour only — no mechanics
// yet (D14: the RPG ruleset, incl. any racial modifiers, is designed later).

export interface RaceDefinition {
   name: string;
   description: string;
}

export const RACES = {
   canid: { name: 'Canid', description: 'Wolves of Aisling — disciplined, martial.' },
   ermehn: { name: 'Ermehn', description: 'Ermine of the Northern Wastes — tattooed, kingdomless, hardy.' },
   felis: { name: 'Felis', description: 'Cats of Kishar — clever, neutral.' },
   lutren: { name: 'Lutren', description: 'Otters of coastal Lutra — water-loving.' },
   polcan: { name: 'Polcan', description: 'Polecats — seafaring, greedy, useful.' },
   tamian: { name: 'Tamian', description: 'Squirrels of forest Terria — agile, tree-loving.' },
   vulpin: { name: 'Vulpin', description: 'Kit foxes of desert Navran — accommodating, sly.' },
} as const satisfies Record<string, RaceDefinition>;

export type RaceId = keyof typeof RACES;
