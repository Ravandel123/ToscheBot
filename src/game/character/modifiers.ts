import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.js';
import { effectDefinition, type ActiveEffectState, type EffectDefinition } from '../data/effects.js';
import { equipmentAttributeModifiers, type EquipSubject } from './inventory.js';

// The ONE place that answers "what is shifting this character's numbers right
// now?". Every roll — skill checks, gathering, dialogue, combat profiles —
// builds its subject through `checkSubject`, so a new kind of modifier (a
// wound, a talent, weather) is one more source here, not an edit at every call
// site. Pure: no Discord, no DB.
//
// Two shapes of modifier exist today: shifts to effective ATTRIBUTES and a flat
// bonus to every CHECK target. A one-off bonus for a single roll (an effort
// level, a tool) is not a source — it belongs in that check's own `modifier`.

export interface ModifierSource {
   kind: 'gear' | 'effect';
   /** Shown to the player ("Equipment", "Dutch Courage"). */
   label: string;
   attributes?: Partial<Record<AttributeKey, number>>;
   checkBonus?: number;
}

export type ModifierSubject = EquipSubject & { effects?: readonly ActiveEffectState[] };

export interface ModifierOptions {
   /** false = gear set aside (a bare-knuckle bout). Default true. */
   gear?: boolean;
   /** The moment effects are judged against. Default now. */
   now?: Date;
}

export interface ActiveEffect {
   effectId: string;
   definition: EffectDefinition;
   expiresAt: Date;
}

/** Effects still running at `now`. Expired or unknown entries are skipped —
 *  they are pruned from storage the next time an effect is applied. */
export function activeEffects(character: Pick<ModifierSubject, 'effects'>, now = new Date()): ActiveEffect[] {
   return (character.effects ?? []).flatMap((state): ActiveEffect[] => {
      const definition = effectDefinition(state.effectId);
      const expiresAt = new Date(state.expiresAt);
      return definition && expiresAt.getTime() > now.getTime() ? [{ effectId: state.effectId, definition, expiresAt }] : [];
   });
}

/** Everything currently modifying the character, one entry per source. */
export function modifierSources(character: ModifierSubject, options: ModifierOptions = {}): ModifierSource[] {
   const sources: ModifierSource[] = [];

   if (options.gear ?? true) {
      const attributes = equipmentAttributeModifiers(character);
      if (Object.keys(attributes).length > 0)
         sources.push({ kind: 'gear', label: 'Equipment', attributes });
   }

   for (const { definition } of activeEffects(character, options.now))
      sources.push({ kind: 'effect', label: definition.name, attributes: definition.attributes, checkBonus: definition.checkBonus });

   return sources;
}

/** Net attribute shift across sources (only attributes that are shifted). */
export function attributeShifts(sources: readonly ModifierSource[]): Partial<Record<AttributeKey, number>> {
   const shifts: Partial<Record<AttributeKey, number>> = {};

   for (const source of sources)
      for (const [key, shift] of Object.entries(source.attributes ?? {}) as [AttributeKey, number][])
         shifts[key] = (shifts[key] ?? 0) + shift;

   return shifts;
}

/** Net flat bonus to every check target across sources. */
export function checkBonus(sources: readonly ModifierSource[]): number {
   return sources.reduce((sum, source) => sum + (source.checkBonus ?? 0), 0);
}

/** Effective attributes with every source applied, floored at 1. */
export function modifiedAttributes(character: ModifierSubject, options: ModifierOptions = {}): Record<AttributeKey, number> {
   const shifts = attributeShifts(modifierSources(character, options));

   return Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, Math.max(1, character.attributes[key] + (shifts[key] ?? 0))]),
   ) as Record<AttributeKey, number>;
}

/** The character as a check should see it: attributes replaced by the modified
 *  set, plus the flat `checkBonus` that `checkTarget` adds. Use this for EVERY
 *  roll instead of passing a raw character document. */
export function checkSubject<T extends ModifierSubject>(character: T, options: ModifierOptions = {}): T & { checkBonus: number } {
   const sources = modifierSources(character, options);
   const shifts = attributeShifts(sources);
   const attributes = Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, Math.max(1, character.attributes[key] + (shifts[key] ?? 0))]),
   ) as Record<AttributeKey, number>;

   return { ...character, attributes, checkBonus: checkBonus(sources) };
}
