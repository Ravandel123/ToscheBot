// The shared flavour lexicon — general-purpose word lists (BtWD-flavoured), ported
// from the old bot's `dataSpeech.js`. NOT fun-specific: fun commands, the server
// RPG, and "real" commands all import and **combine** these. Pure data, no logic;
// keep each list as an `as const` tuple. Generic English *mechanics* (a/an
// exceptions, irregular verbs, syllables…) live with the language helpers in
// `lib/text.ts`, not here — this folder is content, not grammar.

export const WEAPONS = [
   'sword', 'axe', 'gun', 'rocket launcher', 'crossbow', 'minigun', 'shotgun', 'halberd', 'warhammer',
] as const;

export const BODY_PARTS = ['tongue', 'ears', 'fingers', 'toes', 'tail', 'snout', 'whiskers'] as const;

// Good-natured insult parts (Tosch is rude but in a cartoonish way).
export const INSULT_ADJECTIVES = [
   'aberrant', 'abominable', 'absurd', 'amateur', 'barbaric', 'bizarre', 'cave-dwelling', 'crazy', 'creepy',
   'delusional', 'drooly', 'drunken', 'feral', 'ferocious', 'gross', 'hideous', 'inane', 'insane', 'lazy',
   'lobotomized', 'mad', 'maniacal', 'monstrous', 'naive', 'narcissistic', 'nasty', 'ridiculous', 'silly',
   'starving', 'untamed', 'useless', 'vile', 'violent', 'wild',
] as const;

export const INSULT_NOUNS = [
   'abomination', 'bastard', 'clown', 'dork', 'dummy', 'fanatic', 'freak', 'greenpaw', 'lunatic', 'madman',
   'maniac', 'monster', 'mutant', 'nerd', 'newbie', 'noob', 'nutjob', 'peasant', 'psycho', 'savage', 'sicko',
   'troglodyte', 'troll', 'wacko', 'weirdo', 'zombie',
] as const;

// Afflictions / virtues — Darkest-Dungeon-style temperaments (resolve checks, etc.).
export const AFFLICTIONS = [
   'aberrant', 'abusive', 'aggressive', 'anxious', 'barbaric', 'brainwashed', 'cannibalistic', 'crazy',
   'degenerate', 'delusional', 'depressive', 'deviant', 'fearful', 'feral', 'ferocious', 'foolish', 'furious',
   'heartless', 'hopeless', 'idiotic', 'imbecilic', 'insane', 'irrational', 'maniacal', 'mindless', 'murderous',
   'paranoid', 'pathetic', 'perverse', 'primitive', 'psychopathic', 'ravenous', 'selfish', 'stupid',
] as const;

export const VIRTUES = [
   'clever', 'courageous', 'fearsome', 'focused', 'mighty', 'powerful', 'relentless', 'stalwart', 'undying', 'vigorous',
] as const;

// Manner adverbs — for varied action narration ("Tosch savagely smites…"). Ported
// from the old `advBase`. Reusable by combat flavour and commands alike.
export const ADVERBS = [
   'absentmindedly', 'absolutely', 'abstractedly', 'abundantly', 'adoringly', 'aggressively', 'attractively', 'awkwardly',
   'beautifully', 'briskly', 'brutally',
   'cannibalistically', 'carefully', 'cautiously', 'cheerfully', 'cheerily', 'competitively', 'completely', 'conservatively', 'contritely', 'copiously', 'correctly', 'cosmically',
   'deadly',
   'eagerly', 'effectively', 'effortlessly', 'entirely', 'excellently', 'exceptionally', 'excessively', 'extravagantly', 'extremely',
   'famously', 'fantastically', 'faultlessly', 'feebly', 'foolishly', 'frantically', 'furiously',
   'gently', 'gingerly', 'girlishly', 'gorgeously', 'gracefully', 'graciously', 'grimly', 'guardedly',
   'half-heartedly', 'happily', 'heartlessly', 'hungrily',
   'idiotically', 'idly', 'inattentively',
   'lazily', 'lifelessly', 'loyally',
   'magnificently', 'maniacally', 'mindlessly',
   'narcissistically', 'nimbly',
   'overly',
   'perfectly', 'pathetically', 'pleasantly', 'plentifully', 'practically', 'primitively', 'profusely', 'properly', 'purely',
   'quietly', 'questioningly', 'quizzically',
   'ravenously', 'recklessly', 'remorsefully', 'rightly', 'ruefully', 'ruthlessly',
   'savagely', 'silently', 'slightly', 'sloppily', 'splendidly', 'stupidly', 'stylishly', 'superbly', 'sunnily',
   'terribly', 'thirstily', 'totally',
   'unabashedly', 'unevenly', 'urgently', 'utterly',
   'viciously',
   'warily', 'weakly', 'wishfully', 'witlessly', 'wholly', 'worriedly',
] as const;

// Real-world animals — for "you look like a(n) X" roasts; reusable as RPG fauna flavour.
export const ANIMALS = [
   'Alligator', 'Alpaca', 'Amoeba', 'Armadillo', 'Baboon', 'Badger', 'Bat', 'Bear', 'Bee', 'Bull', 'Bumblebee',
   'Cat', 'Chameleon', 'Cheetah', 'Chicken', 'Chimpanzee', 'Cockroach', 'Cow', 'Coyote', 'Cricket', 'Crocodile',
   'Dog', 'Dolphin', 'Donkey', 'Duck', 'Elephant', 'Ermine', 'Ferret', 'Fish', 'Fox', 'Gecko', 'Giraffe', 'Goat',
   'Gorilla', 'Hare', 'Hedgehog', 'Hippo', 'Hornet', 'Horse', 'Iguana', 'Llama', 'Lion', 'Lizard', 'Lynx', 'Macaw',
   'Monkey', 'Moth', 'Mouse', 'Octopus', 'Orangutan', 'Orca', 'Otter', 'Owl', 'Pangolin', 'Panther', 'Parrot',
   'Penguin', 'Pigeon', 'Raccoon', 'Rat', 'Raven', 'Seal', 'Sheep', 'Skink', 'Sloth', 'Snail', 'Snake', 'Spider',
   'Squirrel', 'Swan', 'Tiger', 'Toucan', 'Vulture', 'Wasp', 'Whale', 'Wolf', 'Worm', 'Zebra',
] as const;

// Serious RPG-flavoured classes/titles — for "you'd make a great X" and NPC flavour.
export const CLASSES = [
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
] as const;

// Joke "classes" — the absurd half of the roast pool.
export const FUNNY_CLASSES = [
   'Abomination', 'Android', 'Animal', 'Automaton', 'Bastard', 'Beast', 'Cannibal', 'Colossus', 'Construct',
   'Cyborg', 'Friend', 'Furry', 'Idiot', 'Kid', 'Machine', 'Marionette', 'Monster', 'Mutant', 'Noob', 'Parasite',
   'Pawn', 'Plaything', 'Primitive', 'Robot', 'Sadist', 'Savage', 'Slave', 'Toy', 'Troglodyte', 'Troll', 'Zombie',
] as const;

// Joke places (furry-convention names) — the old bot's running gag for "where".
export const PLACES = [
   'Anthro New England', 'Anthrocon', 'Biggest Little Fur Con', 'Califur', 'ConFurence', 'Confurgence',
   'Eurofurence', 'Furry Fiesta', 'Furry Weekend Atlanta', 'the Gym', 'Mephit Furmeet', 'Middle Earth',
   'Midwest FurFest', 'Rainfurrest', 'Rocky Mountain Fur Con', 'VancouFur',
] as const;

// "Without a doubt" style certainty terms.
export const NO_DOUBT_TERMS = [
   'absolutely', 'assuredly', 'beyond a doubt', 'beyond any doubt', 'certainly', 'clearly', 'definitely',
   'for sure', 'incontrovertibly', 'indubitably', 'irrefutably', 'plainly', 'surely', 'truly', 'undeniably',
   'undisputedly', 'unequivocally', 'unmistakably', 'unquestionably', 'without a doubt',
] as const;

// Accuracy qualifiers — note the empty string (often no qualifier at all).
export const ACCURACY_TERMS = [
   '', 'almost', 'below', 'definitely', 'exactly', 'less than', 'more than', 'over', 'precisely', 'probably',
] as const;

export const EXTREMELY_GOOD = ['amazing', 'incredible', 'out of scale', 'out of this world'] as const;
export const EXTREMELY_BAD = ['trash', 'utter garbage'] as const;

// In-world flavour currencies (for joke pricing — separate from the real game
// currencies, which live in game/data/currencies.ts).
export const FLAVOR_CURRENCIES = [
   'gold coins', 'silver pieces', 'copper bits', 'amber drops', 'pearl flakes', 'Ermehn skulls', 'good fish',
] as const;
