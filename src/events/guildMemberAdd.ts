import { defineEvent } from '../types/events.js';
import { settings } from '../settings.js';
import { resolveGuildChannel } from '../lib/discord.js';

const WELCOME_DM =
   'Welcome to Deltrada, stranger. The Imperator has already been told of your arrival — ' +
   "read the rules, mind your manners, and we'll get along fine. Tosch is always watching, yes-yes.";

// Announces arrivals at the gate and greets the newcomer by DM (best-effort).
export default defineEvent({
   name: 'guildMemberAdd',
   async execute(_client, member) {
      const gate = resolveGuildChannel(member.guild, settings.channels.gate);
      if (gate?.isSendable())
         await gate.send(`Well, well, well... who do we have here? <@${member.id}> just strolled through the gate. I'll be watching this one.`);

      await member.send(WELCOME_DM).catch(() => undefined); // their DMs may be closed
   },
});
