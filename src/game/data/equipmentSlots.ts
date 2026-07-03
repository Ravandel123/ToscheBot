// Equipment slots — where worn/wielded gear sits on a character (D28). The
// character doc's `equipment` map is a schema-flexible object keyed by these
// ids, so ADDING a slot is one entry here (+ catalog items that use it), with
// no migration. Ids are stable slugs (D10): append, never rename — they are
// stored in DB docs and ride in customIds.

export interface EquipmentSlotDefinition {
   name: string;
   emoji: string;
}

export const EQUIPMENT_SLOTS = {
   mainHand: { name: 'Main hand', emoji: '🗡️' },
   offHand: { name: 'Off hand', emoji: '🛡️' },
   head: { name: 'Head', emoji: '🪖' },
   chest: { name: 'Chest', emoji: '🎽' },
   hands: { name: 'Hands', emoji: '🧤' },
   legs: { name: 'Legs', emoji: '👖' },
   feet: { name: 'Feet', emoji: '🥾' },
} as const satisfies Record<string, EquipmentSlotDefinition>;

export type EquipmentSlotId = keyof typeof EQUIPMENT_SLOTS;

export const EQUIPMENT_SLOT_IDS = Object.keys(EQUIPMENT_SLOTS) as EquipmentSlotId[];

/** Type guard for slot ids arriving from customIds / stored docs. */
export function isEquipmentSlotId(id: string): id is EquipmentSlotId {
   return id in EQUIPMENT_SLOTS;
}
