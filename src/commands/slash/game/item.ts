import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { inventoryService } from '../../../db/services/inventoryService.js';
import { displayName } from '../../../game/character/identity.js';
import { INVENTORY_STACK_LIMIT } from '../../../game/character/inventory.js';
import {
   DEFAULT_ITEM_QUALITY,
   ITEMS,
   ITEM_IDS,
   ITEM_KINDS,
   ITEM_QUALITIES,
   isItemQualityId,
   itemDefinition,
} from '../../../game/data/items.js';

// Imperator-side item administration (D28). `grant` is the prototype's only
// loot source: it conjures catalog items into a player's active character's
// pack (for testing and hand-run events) until real sources land (loot,
// shops, crafting). A subcommand so future tools (`/item inspect`, `/item
// confiscate`) join without a new top-level command.
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

export default {
   data: new SlashCommandBuilder()
      .setName('item')
      .setDescription('Item administration (Imperator only).')
      .addSubcommand((sub) =>
         sub
            .setName('grant')
            .setDescription('Conjure items into a player\'s active character\'s pack.')
            .addUserOption((option) => option.setName('player').setDescription('Whose active character receives them.').setRequired(true))
            .addStringOption((option) => option.setName('item').setDescription('Which item (search by name).').setRequired(true).setAutocomplete(true))
            .addStringOption((option) =>
               option
                  .setName('quality')
                  .setDescription('Craftsmanship tier (default: Common).')
                  .addChoices(...Object.entries(ITEM_QUALITIES).map(([id, def]) => ({ name: def.name, value: id }))),
            )
            .addIntegerOption((option) => option.setName('quantity').setDescription('How many (default: 1).').setMinValue(1).setMaxValue(99)),
      ),
   category: 'game',
   ownerOnly: true,
   async execute(client, interaction) {
      // Only 'grant' exists so far — route explicitly once a second subcommand lands.
      const player = interaction.options.getUser('player', true);
      const itemId = interaction.options.getString('item', true);
      const rawQuality = interaction.options.getString('quality') ?? DEFAULT_ITEM_QUALITY;
      const quality = isItemQualityId(rawQuality) ? rawQuality : DEFAULT_ITEM_QUALITY;
      const quantity = interaction.options.getInteger('quantity') ?? 1;

      const definition = itemDefinition(itemId);
      if (!definition) {
         await interaction.reply({ content: 'No such item in the catalog. Pick one from the autocomplete.', ...ephemeral });
         return;
      }

      const character = await accountService.peekActiveCharacter(player.id);
      if (!character) {
         await interaction.reply({ content: `**${player.displayName}** has no active character to receive it.`, ...ephemeral });
         return;
      }

      // The grant races the player's own panel actions — take their lock (may
      // wait behind a fight, so acknowledge first).
      await interaction.deferReply(ephemeral);

      await client.locks.runExclusive([character._id], async () => {
         const result = await inventoryService.grantItems(character._id, itemId, quality, quantity);

         if (!result.ok) {
            const reasons: Record<typeof result.reason, string> = {
               'not-found': 'That character no longer exists.',
               'unknown-item': 'No such item in the catalog.',
               'inventory-full': `Their pack is full (${INVENTORY_STACK_LIMIT} entries).`,
               'too-heavy': 'They cannot carry that much weight.',
            };
            await interaction.editReply(reasons[result.reason]);
            return;
         }

         const prefix = ITEM_QUALITIES[quality].prefix;
         const name = prefix ? `${prefix} ${definition.name}` : definition.name;
         await interaction.editReply(
            `📦 Granted **${name}**${quantity > 1 ? ` ×${quantity}` : ''} to **${displayName(character)}** (${player.displayName}).`,
         );
      });
   },
   async autocomplete(_client, interaction) {
      const focused = interaction.options.getFocused().toLowerCase();

      const choices = ITEM_IDS
         .filter((id) => ITEMS[id].name.toLowerCase().includes(focused) || id.includes(focused))
         .slice(0, 25)
         .map((id) => ({ name: `${ITEMS[id].name} — ${ITEM_KINDS[ITEMS[id].kind].name}`, value: id }));

      await interaction.respond(choices);
   },
} satisfies SlashCommand;
