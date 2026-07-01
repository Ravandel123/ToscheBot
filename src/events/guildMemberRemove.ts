import { defineEvent } from '../types/events.js';
import { settings } from '../settings.js';
import { resolveGuildChannel } from '../lib/discord.js';

// Announces departures at the gate.
export default defineEvent({
   name: 'guildMemberRemove',
   async execute(_client, member) {
      const gate = resolveGuildChannel(member.guild, settings.channels.gate);
      if (gate?.isSendable())
         await gate.send(`${member.user.username} bolted through the gate! A deserter! ...Bah. Good riddance.`);
   },
});
