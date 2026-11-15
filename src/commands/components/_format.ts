// The level-up wording every banner shares (foraging, challenges, dialogue,
// examine, bouts), so skill growth reads the same everywhere. Underscore
// prefix → loader skips it.
import { skillNode } from '../../game/data/skills.js';
import type { SkillLevelUp } from '../../game/character/skills.js';

/** "**Athletics** rises to **4**, **Climbing** rises to **2**". */
export function levelUpList(levelUps: readonly SkillLevelUp[]): string {
   return levelUps.map((up) => `**${skillNode(up.node).name}** rises to **${up.to}**`).join(', ');
}
