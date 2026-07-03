import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../../types/commands.js';
import { accountService } from '../../../db/services/accountService.js';
import { characterService } from '../../../db/services/characterService.js';
import { activitySessionService } from '../../../db/services/activitySessionService.js';
import { canCharacterAct, type ActBlockReason } from '../../../game/character/rules.js';
import { attributesWithEquipment } from '../../../game/character/inventory.js';
import { displayName } from '../../../game/character/identity.js';
import { LOCATIONS, locationName, type LocationId } from '../../../game/data/locations.js';
import { TRAVEL_AP_COST, checkTravel, connectionsFrom, type TravelBlockReason } from '../../../game/world/travel.js';
import { rollTravelEncounter } from '../../../game/world/encounters.js';
import { initialChallengeState } from '../../../game/activity/challenge.js';
import { checkTarget } from '../../../game/checks.js';
import { postChronicle } from '../../../game/chronicle.js';
import { randomItem } from '../../../lib/random.js';
import { activityHandler } from '../../components/_activities/registry.js';
import type { ActivityEncounter, EncounterId } from '../../../game/data/encounters.js';
import type { ActivitySessionDoc } from '../../../db/models/activitySession.js';
import type { CharacterDoc } from '../../../db/models/character.js';

// The first real consumer of `canCharacterAct` (D13/D21): moving the active
// character along the location graph. A plain move is a short atomic action
// (validate → spend AP → setLocation). A rolled 'activity' encounter instead
// interrupts the move with a durable ActivitySession (D17) — arrival then
// depends on how that activity ends. Steps are ephemeral; outcomes go to the
// public chronicle (D24).
const ephemeral = { flags: MessageFlags.Ephemeral } as const;

const ACT_BLOCK_MESSAGE: Record<ActBlockReason, string> = {
   'not-approved': 'Only characters recognized by the Imperator may roam Deltrada. Finish yours with `/character edit` and submit it.',
   'incapacitated': 'You are in no state to travel — recover first.',
   'no-action-points': 'You lack the Action Points for the road.',
};

export default {
   data: new SlashCommandBuilder()
      .setName('travel')
      .setDescription('Travel your active character to a connected location.')
      .addStringOption((option) =>
         option.setName('destination').setDescription('Where to go (connected to where you are).').setRequired(true).setAutocomplete(true),
      ),
   category: 'game',
   async execute(client, interaction) {
      if (!interaction.guild) {
         await interaction.reply({ content: 'The roads of Deltrada are on the server, not in DMs.', ...ephemeral });
         return;
      }

      const character = await accountService.getActiveCharacter(interaction.user.id, interaction.user.displayName);
      if (!character) {
         await interaction.reply({ content: 'You have no active character. Draft one with `/character create`.', ...ephemeral });
         return;
      }

      if (client.locks.isLocked(character._id)) {
         await interaction.reply({ content: 'Your character is mid-activity — finish it first.', ...ephemeral });
         return;
      }

      const destination = interaction.options.getString('destination', true);

      // Acknowledge before taking the lock: the character may be queued behind
      // a long fight, and an interaction only waits ~3 s for its first reply.
      await interaction.deferReply(ephemeral);

      // Serialize the whole decision (busy-check → spend → move/encounter) per
      // character, so a double-fired command can't move twice or open two
      // sessions; the second run re-checks inside the lock and re-enters.
      await client.locks.runExclusive([character._id], async () => {
         const fresh = await characterService.get(character._id);
         if (!fresh) {
            await interaction.editReply('Your character vanished mid-stride. Try again.');
            return;
         }

         // Cross-restart busy check (D17): an active session means re-entry, not an error.
         const session = await activitySessionService.getActiveForParticipant(fresh._id);
         if (session) {
            await replyWithActiveSession(interaction, session);
            return;
         }

         const act = canCharacterAct(fresh, TRAVEL_AP_COST);
         if (!act.ok) {
            await interaction.editReply(ACT_BLOCK_MESSAGE[act.reason]);
            return;
         }

         const travel = checkTravel(fresh.locationId, destination);
         if (!travel.ok) {
            await interaction.editReply(travelBlockMessage(travel.reason, travel.from));
            return;
         }

         if (!await characterService.spendActionPoints(fresh._id, TRAVEL_AP_COST)) {
            await interaction.editReply(ACT_BLOCK_MESSAGE['no-action-points']);
            return;
         }

         const rolled = rollTravelEncounter(travel.to);

         // An 'activity' encounter interrupts the move — the character only
         // arrives if the activity ends in success (its handler moves them).
         if (rolled?.encounter.kind === 'activity') {
            const started = await startEncounterActivity(interaction, fresh, rolled.id, rolled.encounter, travel.from, travel.to);
            if (started)
               return;
         }

         await characterService.setLocation(fresh._id, travel.to);

         const flavorLine = rolled?.encounter.kind === 'flavor' ? randomItem(rolled.encounter.lines) : null;
         await interaction.editReply([
            `🧭 You leave **${locationName(travel.from)}** and arrive at **${locationName(travel.to)}**.`,
            `_${LOCATIONS[travel.to].description}_`,
            flavorLine ? `\n${flavorLine}` : '',
         ].filter(Boolean).join('\n'));

         await postChronicle(client, [
            `🧭 **${displayName(fresh)}** traveled from **${locationName(travel.from)}** to **${locationName(travel.to)}**.`,
            flavorLine ? ` ${flavorLine}` : '',
         ].join(''));
      });
   },
   async autocomplete(_client, interaction) {
      const focused = interaction.options.getFocused().toLowerCase();
      // Read-only lookup: autocomplete fires on every keystroke and must not
      // create accounts/starters as a side effect (the execute path does that).
      const character = await accountService.peekActiveCharacter(interaction.user.id);
      if (!character) {
         await interaction.respond([]);
         return;
      }

      const choices = connectionsFrom(character.locationId)
         .map((id) => ({ name: LOCATIONS[id].name, value: id }))
         .filter((choice) => choice.name.toLowerCase().includes(focused))
         .slice(0, 25);

      await interaction.respond(choices);
   },
} satisfies SlashCommand;

/** Spawns the ActivitySession for an 'activity' encounter and shows its first
 *  step. Each activity type builds its own initial state — add a case when a
 *  new encounter activity lands. Unknown types degrade to no encounter. */
async function startEncounterActivity(
   interaction: ChatInputCommandInteraction,
   character: CharacterDoc,
   encounterId: EncounterId,
   encounter: ActivityEncounter,
   from: LocationId,
   to: LocationId,
): Promise<boolean> {
   // Travel's AP charge is the session's start cost (D17: charged at start;
   // clean cancel refunds; timeout forfeits) — no extra charge here.
   if (encounter.activityType !== 'challenge')
      return false;

   // Per-option d100 targets are computed HERE, from the live character, and
   // stored in the session state — the stateless panel then shows honest %
   // odds on every repaint without re-deriving stats (D26). Equipped gear
   // shifts the attributes (plate drags your climb — D28); it can't change
   // mid-challenge because the busy gate freezes gear while a session runs.
   const subject = { ...character, attributes: attributesWithEquipment(character) };
   const optionTargets = Object.fromEntries(
      encounter.options.flatMap((option) => (option.check ? [[option.id, checkTarget(subject, option.check)] as const] : [])),
   );

   const session = await activitySessionService.create('challenge', [character._id], { ...initialChallengeState(encounterId, from, to, optionTargets) });
   await replyWithSessionStep(interaction, session, `⚠️ **${encounter.name}!**`);
   return true;
}

/** Re-entry (D22): trying to act while mid-activity re-renders the current step. */
async function replyWithActiveSession(interaction: ChatInputCommandInteraction, session: ActivitySessionDoc): Promise<void> {
   await replyWithSessionStep(interaction, session, '⚠️ You are already in the middle of something — deal with it first.');
}

async function replyWithSessionStep(interaction: ChatInputCommandInteraction, session: ActivitySessionDoc, note: string): Promise<void> {
   const handler = activityHandler(session.type);

   if (!handler) {
      await interaction.editReply(`${note}\n(Your character is busy with: ${session.type}.)`);
      return;
   }

   await interaction.editReply({ content: note, ...handler.render(session) });
}

function travelBlockMessage(reason: TravelBlockReason, from: LocationId): string {
   const roads = connectionsFrom(from).map((id) => `**${LOCATIONS[id].name}**`).join(', ') || 'nowhere';

   if (reason === 'same-location')
      return `You are already at **${locationName(from)}**. Roads lead to: ${roads}.`;
   if (reason === 'not-connected')
      return `No road leads there from **${locationName(from)}**. You can reach: ${roads}.`;
   return `No such place is known. From **${locationName(from)}** you can reach: ${roads}.`;
}
