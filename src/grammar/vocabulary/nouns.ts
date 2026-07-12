// Noun pools. Two kinds of keys live here:
//   • SITUATION props (combat/labor/mystic/tavern/wilds) — tangible scene features
//     that must read naturally after "near the …" / "by the …" (the default
//     patterns use them as backdrop; ACTORS belong in beings.ts).
//   • LEGACY pools ported from the old lexicon — display-oriented lists whose
//     casing is preserved (fun commands bold/capitalize them as-is).

export const NOUNS = {
   combat: ['armory', 'banner', 'barricade', 'palisade', 'rampart', 'watchtower'],
   labor: ['anvil', 'cart', 'granary', 'sawpit', 'scaffold', 'workbench'],
   mystic: ['altar', 'cairn', 'old well', 'ritual circle', 'shrine', 'standing stone'],
   tavern: ['ale barrel', 'cellar', 'dice table', 'hearth', 'long table'],
   wilds: ['brook', 'den', 'game trail', 'ridge', 'riverbank', 'thicket'],

   // --- Legacy pools (casing preserved for display use) -------------------------

   // Real-world animals — "you look like a(n) X" roasts; reusable as RPG fauna flavour.
   animal: [
      'Alligator', 'Alpaca', 'Amoeba', 'Armadillo', 'Baboon', 'Badger', 'Bat', 'Bear', 'Bee', 'Bull', 'Bumblebee',
      'Cat', 'Chameleon', 'Cheetah', 'Chicken', 'Chimpanzee', 'Cockroach', 'Cow', 'Coyote', 'Cricket', 'Crocodile',
      'Dog', 'Dolphin', 'Donkey', 'Duck', 'Elephant', 'Ermine', 'Ferret', 'Fish', 'Fox', 'Gecko', 'Giraffe', 'Goat',
      'Gorilla', 'Hare', 'Hedgehog', 'Hippo', 'Hornet', 'Horse', 'Iguana', 'Llama', 'Lion', 'Lizard', 'Lynx', 'Macaw',
      'Monkey', 'Moth', 'Mouse', 'Octopus', 'Orangutan', 'Orca', 'Otter', 'Owl', 'Pangolin', 'Panther', 'Parrot',
      'Penguin', 'Pigeon', 'Raccoon', 'Rat', 'Raven', 'Seal', 'Sheep', 'Skink', 'Sloth', 'Snail', 'Snake', 'Spider',
      'Squirrel', 'Swan', 'Tiger', 'Toucan', 'Vulture', 'Wasp', 'Whale', 'Wolf', 'Worm', 'Zebra',
   ],

   body: ['tongue', 'ears', 'fingers', 'toes', 'tail', 'snout', 'whiskers'],

   // In-world flavour currencies (for joke pricing — separate from the real game
   // currencies, which live in game/data/currencies.ts).
   currency: [
      'gold coins', 'silver pieces', 'copper bits', 'amber drops', 'pearl flakes', 'Ermehn skulls', 'good fish',
   ],

   // Joke "classes" — the absurd half of the roast pool.
   funnyProfession: [
      'Abomination', 'Android', 'Animal', 'Automaton', 'Bastard', 'Beast', 'Cannibal', 'Colossus', 'Construct',
      'Cyborg', 'Friend', 'Furry', 'Idiot', 'Kid', 'Machine', 'Marionette', 'Monster', 'Mutant', 'Noob', 'Parasite',
      'Pawn', 'Plaything', 'Primitive', 'Robot', 'Sadist', 'Savage', 'Slave', 'Toy', 'Troglodyte', 'Troll', 'Zombie',
   ],

   // Joke places (furry-convention names) — the old bot's running gag for "where".
   furryCon: [
      'Anthro New England', 'Anthrocon', 'Biggest Little Fur Con', 'Califur', 'ConFurence', 'Confurgence',
      'Eurofurence', 'Furry Fiesta', 'Furry Weekend Atlanta', 'the Gym', 'Mephit Furmeet', 'Middle Earth',
      'Midwest FurFest', 'Rainfurrest', 'Rocky Mountain Fur Con', 'VancouFur',
   ],

   // Good-natured insult nouns (Tosch is rude but in a cartoonish way).
   insult: [
      'abomination', 'bastard', 'clown', 'dork', 'dummy', 'fanatic', 'freak', 'greenpaw', 'lunatic', 'madman',
      'maniac', 'monster', 'mutant', 'nerd', 'newbie', 'noob', 'nutjob', 'peasant', 'psycho', 'savage', 'sicko',
      'troglodyte', 'troll', 'wacko', 'weirdo', 'zombie',
   ],

   // Serious RPG-flavoured classes/titles — "you'd make a great X" and NPC flavour.
   profession: [
      'Abbot', 'Admiral', 'Alchemist', 'Ambassador', 'Antiquarian', 'Apothecary', 'Arbalest', 'Archer', 'Artisan',
      'Assassin', 'Astrologer', 'Bandit', 'Barbarian', 'Bard', 'Baron', 'Berserker', 'Bodyguard', 'Bombardier',
      'Brigand', 'Burglar', 'Butcher', 'Cadet', 'Cantor', 'Captain', 'Cartographer', 'Champion', 'Charlatan',
      'Chevalier', 'Crusader', 'Cultist', 'Defender', 'Doctor', 'Druid', 'Duelist', 'Elder', 'Embalmer', 'Enforcer',
      'Engineer', 'Envoy', 'Executioner', 'Exorcist', 'Explorer', 'Farmer', 'Fighter', 'Fisherman', 'Flagellant',
      'Fool', 'Friar', 'Gambler', 'Guard', 'Guardian', 'Gunner', 'Hellion', 'Herald', 'Highwayman', 'Hunter',
      'Inquisitor', 'Jailer', 'Jester', 'Killer', 'King', 'Knight', 'Lamplighter', 'Lich', 'Lord', 'Lumberjack',
      'Mage', 'Magician', 'Man-at-Arms', 'Marauder', 'Mariner', 'Mercenary', 'Merchant', 'Messenger', 'Miner',
      'Minstrel', 'Monk', 'Mystic', 'Navigator', 'Necromancer', 'Ninja', 'Noble', 'Nomad', 'Occultist', 'Outlaw',
      'Paladin', 'Peasant', 'Physician', 'Pilgrim', 'Pistolier', 'Priest', 'Prophet', 'Queen', 'Raider', 'Ranger',
      'Reaver', 'Rogue', 'Ruffian', 'Sailor', 'Samurai', 'Scholar', 'Scout', 'Scribe', 'Seer', 'Sergeant', 'Servant',
      'Shaman', 'Shepherd', 'Slayer', 'Smuggler', 'Soldier', 'Sorcerer', 'Spy', 'Squire', 'Steward', 'Surgeon',
      'Templar', 'Thief', 'Thug', 'Torturer', 'Trapper', 'Vagabond', 'Valkyrie', 'Veteran', 'Warden', 'Warlock',
      'Warlord', 'Warrior', 'Watchman', 'Witch', 'Witcher', 'Wizard', 'Woodsman', 'Yeoman', 'Zealot',
   ],

   weapon: [
      'sword', 'axe', 'gun', 'rocket launcher', 'crossbow', 'minigun', 'shotgun', 'halberd', 'warhammer',
   ],
} as const satisfies Record<string, readonly string[]>;

export type NounTheme = keyof typeof NOUNS;
