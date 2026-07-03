// Discord adapter (marked): the public character sheet — `/character view`
// (the embed that used to be `/profile` pre-D27), now with attributes and any
// earned deed traits. Underscore prefix → loader skips it.
import { EmbedBuilder } from 'discord.js';
import { RESOURCES } from '../../../game/data/resources.js';
import { CURRENCIES } from '../../../game/data/currencies.js';
import { RACES } from '../../../game/data/races.js';
import { ATTRIBUTES, ATTRIBUTE_KEYS } from '../../../game/data/attributes.js';
import { TRAITS, TRAIT_KEYS } from '../../../game/data/traits.js';
import { locationName } from '../../../game/data/locations.js';
import { displayName, isHttpUrl, STATUS_LABEL } from '../../../game/character/identity.js';
import type { CharacterDoc } from '../../../db/models/character.js';

export function buildCharacterSheet(character: CharacterDoc): EmbedBuilder {
   const resources = Object.entries(RESOURCES)
      .map(([key, def]) => {
         const state = character.resources[key as keyof typeof RESOURCES];
         return `**${def.name}:** ${state.current}/${state.max}`;
      })
      .join('\n');

   const currencies = Object.entries(CURRENCIES)
      .map(([key, def]) => `${def.emoji} **${def.name}:** ${character.currencies[key as keyof typeof CURRENCIES]}`)
      .join('\n');

   const attributes = ATTRIBUTE_KEYS
      .map((key) => `**${ATTRIBUTES[key].abbreviation}** ${character.attributes[key] ?? '—'}`)
      .join(' · ');

   // Traits are earned by deeds — only what the character has actually become.
   const traits = TRAIT_KEYS
      .filter((key) => (character.traits?.[key] ?? 0) > 0)
      .map((key) => `${TRAITS[key].emoji} **${TRAITS[key].name}** ${character.traits[key]}`)
      .join(' · ');

   const race = character.identity.race ? RACES[character.identity.race].name : 'Unknown';

   const embed = new EmbedBuilder()
      .setTitle(displayName(character))
      .setDescription(`${STATUS_LABEL[character.approvalStatus]} · ${race} · 📍 ${locationName(character.locationId)}`)
      .addFields(
         { name: 'Action Points', value: `${character.actionPoints.current}`, inline: false },
         { name: 'Vitals', value: resources, inline: true },
         { name: 'Currencies', value: currencies, inline: true },
         { name: 'Attributes', value: attributes },
         ...(traits ? [{ name: 'Traits', value: traits }] : []),
      );

   if (isHttpUrl(character.identity.avatarUrl))
      embed.setThumbnail(character.identity.avatarUrl);

   return embed;
}
