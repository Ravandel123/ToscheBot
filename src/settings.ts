// Server-specific tunables for the single guild (Deltrada). This is the one
// place to edit channel names, the banned-word list, and AI trigger behaviour —
// no ids or channel names hardcoded across the codebase (an OldBot anti-pattern).
// Plain data: edit freely, no logic here.

export const settings = {
   // Channel references accept EITHER a channel id (digits — rename-proof) OR a
   // channel name (readable). `resolveGuildChannel` figures out which.
   channels: {
      // Moderation reports (deleted banned-word messages, admin actions) go here.
      espionage: '861356853811740692',
      // Where smackdown fights are narrated.
      smackdownSpire: 'smackdown-spire',
      // Owner-only channel for character-approval requests / Imperial decrees.
      imperialDecrees: 'imperial-decrees',
      // Where arrivals and departures are announced (welcomes & farewells).
      gate: 'main-gate',
   },

   moderation: {
      // Messages containing any of these (case-insensitive, also matched after
      // stripping spaces/punctuation) are deleted and reported to #espionage.
      // The owner is exempt.
      bannedWords: [
         'cunt',
         'dick',
         'faggot', 'fuck',
         'god damn', 'goddammit', 'goddamnit',
         'huj',
         'kurv', 'kurw',
         'nigga', 'nigger',
         'pierdol',
         'e621.net', 'furaffinity.net', 'weasyl.com',
      ],
   },

   ai: {
      // A message whose text starts with one of these (case-insensitive) gets an
      // AI reply — e.g. "Tosche, what do you think?".
      triggerNames: ['tosch', 'tosche'],
      // Any message in these channels gets an AI reply.
      channels: ['tosche-office'],
      // Random chance (percent) that Tosche butts into an ordinary message.
      ambientChancePercent: 1,
      // Channels where Tosche never speaks on his own (ambient chance ignored).
      // Name triggers still work.
      silentChannels: ['rules', 'deltrada-guide', 'knowledge-center'],
      // How many recent messages to feed the model as conversation context.
      historyLimit: 8,
   },
} as const;
