// Discord adapter (marked): the public character sheet — `/character view`
// (the embed that used to be `/profile` pre-D27), now with attributes and any
// earned deed traits. Underscore prefix → loader skips it.
import { EmbedBuilder } from 'discord.js';
import { RESOURCES } from '../../../game/data/resources.js';
import { CURRENCIES } from '../../../game/data/currencies.js';
import { RACES } from '../../../game/data/races.js';
import { ATTRIBUTES, ATTRIBUTE_KEYS } from '../../../game/data/attributes.js';
import { TRAITS, TRAIT_KEYS } from '../../../game/data/traits.js';
import { EQUIPMENT_SLOTS } from '../../../game/data/equipmentSlots.js';
import { locationName } from '../../../game/data/locations.js';
import { displayName, isHttpUrl, STATUS_LABEL } from '../../../game/character/identity.js';
import { equipmentAttributeModifiers, equippedItems, itemDisplayName, totalEquippedArmor } from '../../../game/character/inventory.js';
import { ageBandName, bodyOf, bodyShapeName, moveSpeed } from '../../../game/character/body.js';
import { cmToImperial, kgToImperial } from '../../../lib/units.js';
import type { UnitSystem } from '../../../db/models/account.js';
import type { CharacterDoc } from '../../../db/models/character.js';

/** The character sheet. `units` is the VIEWER's preference (R19) — the frame is
 *  stored metric and shown imperial only when the viewer asked for it. */
export function buildCharacterSheet(character: CharacterDoc, units: UnitSystem = 'metric'): EmbedBuilder {
   const resources = Object.entries(RESOURCES)
      .map(([key, def]) => {
         const state = character.resources[key as keyof typeof RESOURCES];
         return `**${def.name}:** ${state.current}/${state.max}`;
      })
      .join('\n');

   const currencies = Object.entries(CURRENCIES)
      .map(([key, def]) => `${def.emoji} **${def.name}:** ${character.currencies[key as keyof typeof CURRENCIES]}`)
      .join('\n');

   // Equipped gear shifts effective attributes (D28): show `effective (base±mod)`
   // so a plated canid can see exactly what the steel costs him.
   const modifiers = equipmentAttributeModifiers(character);
   const attributes = ATTRIBUTE_KEYS
      .map((key) => {
         const base = character.attributes[key];
         const shift = modifiers[key] ?? 0;
         if (base === undefined)
            return `**${ATTRIBUTES[key].abbreviation}** —`;
         if (shift === 0)
            return `**${ATTRIBUTES[key].abbreviation}** ${base}`;
         return `**${ATTRIBUTES[key].abbreviation}** ${Math.max(1, base + shift)} (${base}${shift > 0 ? '+' : ''}${shift})`;
      })
      .join(' · ');

   const gear = equippedItems(character)
      .map(({ slot, item }) => `${EQUIPMENT_SLOTS[slot].emoji} **${EQUIPMENT_SLOTS[slot].name}:** ${itemDisplayName(item)}`)
      .join('\n');

   // Traits are earned by deeds — only what the character has actually become.
   const traits = TRAIT_KEYS
      .filter((key) => (character.traits?.[key] ?? 0) > 0)
      .map((key) => `${TRAITS[key].emoji} **${TRAITS[key].name}** ${character.traits[key]}`)
      .join(' · ');

   const race = character.identity.race ? RACES[character.identity.race].name : 'Unknown';

   // Frame (R20): stored metric, shown per the viewer's unit preference. Shape
   // and move speed are derived (never stored).
   const body = bodyOf(character);
   const height = units === 'imperial' ? cmToImperial(body.heightCm) : `${body.heightCm} cm`;
   const weight = units === 'imperial' ? kgToImperial(body.weightKg) : `${body.weightKg} kg`;
   const bodyValue = [
      `**Height:** ${height} · **Weight:** ${weight} · **Build:** ${bodyShapeName(body)}`,
      `**Age:** ${body.age} (${ageBandName(body.age)}) · **Move:** ${moveSpeed(character.identity.race, character.attributes)}`,
   ].join('\n');

   const embed = new EmbedBuilder()
      .setTitle(displayName(character))
      .setDescription(`${STATUS_LABEL[character.approvalStatus]} · ${race} · 📍 ${locationName(character.locationId)}`)
      .addFields(
         { name: 'Action Points', value: `${character.actionPoints.current}`, inline: false },
         { name: 'Vitals', value: resources, inline: true },
         { name: 'Currencies', value: currencies, inline: true },
         { name: 'Body', value: bodyValue },
         { name: 'Attributes', value: attributes },
         ...(gear ? [{ name: `Equipment · 🛡️ Armor ${totalEquippedArmor(character)}`, value: gear }] : []),
         ...(traits ? [{ name: 'Traits', value: traits }] : []),
      );

   if (isHttpUrl(character.identity.avatarUrl))
      embed.setThumbnail(character.identity.avatarUrl);

   return embed;
}
