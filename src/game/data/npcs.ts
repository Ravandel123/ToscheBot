import type { ItemId, ItemQualityId } from './items.js';
import type { LocationId } from './locations.js';
import type { RaceId } from './races.js';
import type { GENDER_CHOICES } from '../character/identity.js';

// The hand-authored NPC roster (Phase 6C, static half — npcs.md R18). An NPC is
// an ordinary Character with `ownerId: null` (D12): same attributes, inventory,
// locks and presence as a player character. This catalog is the STATIC side of
// that split (D10): everything here resolves from code at read time — the DB
// stores only the character doc itself, minted from this roster by
// `npm run seed-npcs` (scripts/npcSeed.ts).
//
// The link between catalog and doc is the character id: an NPC's Character._id
// is `npc-<npcId>` (npcCharacterId below) — stable, append-only (D10 rule 2),
// and ':'-free because character ids ride in colon-separated customIds. That id
// doubles as the seed's idempotency key: a reseed UPDATES the static half
// (identity, race, home) and never resets what the world has mutated since
// (pack, coins, resources, progression — AUDIT §3.3).
//
// startingInventory/startingCoins are granted ONCE, on first seed. 🟡 All coin
// amounts are balance placeholders until the owner signs off (the plaza
// merchant's pool is the S3 shop's real, finite trading gold).

export type NpcGender = (typeof GENDER_CHOICES)[number]['value'];

// Which behavior profile / player-facing verbs fit this NPC (npcs.md's
// archetype table). DATA-ONLY seam today: nothing reads it at runtime until
// the S3 shop (merchant) and the npc-tick cron (Decision queue #7) land.
export type NpcArchetype = 'guard' | 'homebody' | 'laborer' | 'merchant' | 'wanderer';

export interface NpcStartingItem {
   itemId: ItemId;
   /** Craftsmanship tier of the granted instance(s) (default: common). */
   quality?: ItemQualityId;
   quantity?: number;
}

export interface NpcDefinition {
   name: string;
   race: RaceId;
   gender: NpcGender;
   /** Doubles as the job title — presence shows "Name, epithet" (displayName). */
   epithet: string;
   bio: string;
   /** Where the NPC spawns — and, once the npc-tick cron exists, returns to. */
   homeLocationId: LocationId;
   archetype: NpcArchetype;
   /** Granted on CREATE only — from then on the pack is the NPC's own mutable
    *  state, never touched by a reseed. Must fit the race's carry capacity
    *  (strength in kg — test-validated). */
   startingInventory?: readonly NpcStartingItem[];
   /** 🟡 Starting deltradaCoins, granted on CREATE only (see startingInventory). */
   startingCoins?: number;
}

export const NPCS = {
   plaza_merchant: {
      name: 'Nazir',
      race: 'vulpin',
      gender: 'male',
      epithet: 'the Plaza Merchant',
      bio: 'A Navrani trader who followed the caravans west until Deltrada\'s plaza turned out to be where the coin slept. Sells a little of everything, remembers every price he ever quoted, and considers haggling a form of courtship.',
      homeLocationId: 'plaza',
      archetype: 'merchant',
      startingCoins: 250,
      startingInventory: [
         { itemId: 'travel_rations', quantity: 6 },
         { itemId: 'healers_poultice', quantity: 3 },
         { itemId: 'linen_bolt', quantity: 2 },
         { itemId: 'honeyed_mead', quantity: 2 },
      ],
   },
   tavernkeeper: {
      name: 'Serna',
      race: 'lutren',
      gender: 'female',
      epithet: 'Keeper of the Sunken Tankard',
      bio: 'A shipwright\'s daughter from the Lutra coast who dropped anchor inland. Runs the Tankard with a bosun\'s patience: pays her debts, waters no mead, and has thrown out soldiers twice her size without spilling a drop.',
      homeLocationId: 'tavern',
      archetype: 'homebody',
      startingCoins: 120,
      startingInventory: [
         { itemId: 'honeyed_mead', quantity: 5 },
         { itemId: 'dried_carp', quantity: 4 },
         { itemId: 'cracked_tankard' },
      ],
   },
   spire_guard: {
      name: 'Dagna',
      race: 'canid',
      gender: 'female',
      epithet: 'Gate Guard of the Spire',
      bio: 'Third generation of Deltrada garrison stock. Holds the Spire gate through rain, fog and visiting dignitaries, and can recite the watch roster from ten years back faster than most recite their prayers.',
      homeLocationId: 'spire',
      archetype: 'guard',
      startingInventory: [
         { itemId: 'ash_spear' },
         { itemId: 'wooden_buckler' },
         { itemId: 'leather_jerkin' },
      ],
   },
   ferryman: {
      name: 'Corvas',
      race: 'polcan',
      gender: 'male',
      epithet: 'the Ferryman',
      bio: 'A polcan exile who traded the Western Sea for a river he can see across. Poles the crossing at dawn and dusk, mends his net in between, and charges double for passengers who call his ferry a raft.',
      homeLocationId: 'riverbank',
      archetype: 'laborer',
      startingCoins: 40,
      startingInventory: [
         { itemId: 'quarterstaff' },
         { itemId: 'weighted_net' },
         { itemId: 'dried_carp', quantity: 2 },
      ],
   },
   herb_gatherer: {
      name: 'Hazel',
      race: 'tamian',
      gender: 'female',
      epithet: 'the Herb-Gatherer',
      bio: 'A Terrian forager who knows the Tanglewood by smell alone. Sells what the infirmary needs and eats the rest — she has been wrong about a mushroom exactly once, and tells the story like a war memoir.',
      homeLocationId: 'tanglewood',
      archetype: 'laborer',
      startingCoins: 15,
      startingInventory: [
         { itemId: 'honeycap_mushroom', quantity: 3 },
         { itemId: 'stingweed', quantity: 2 },
         { itemId: 'duskberry', quantity: 3 },
      ],
   },
   old_campaigner: {
      name: 'Marrek',
      race: 'canid',
      gender: 'male',
      epithet: 'the Old Campaigner',
      bio: 'Mustered out after thirty years on the wall. Holds the Tankard\'s corner table like a last redoubt, trades war stories for mead, and insists every scar has a better version of the same story.',
      homeLocationId: 'tavern',
      archetype: 'homebody',
      startingCoins: 25,
      startingInventory: [
         { itemId: 'iron_dagger' },
         { itemId: 'bent_spoon' },
      ],
   },
   wandering_scholar: {
      name: 'Vellin',
      race: 'felis',
      gender: 'male',
      epithet: 'Scholar of Kishar',
      bio: 'A Kishar archivist on an indefinite field study of "frontier fortifications and the people who insist on living in them." Measures walls, sketches gates, and asks one question more than anyone is comfortable answering.',
      homeLocationId: 'plaza',
      archetype: 'wanderer',
      startingCoins: 60,
      startingInventory: [
         { itemId: 'quarterstaff' },
      ],
   },
} as const satisfies Record<string, NpcDefinition>;

export type NpcId = keyof typeof NPCS;

export const NPC_IDS = Object.keys(NPCS) as NpcId[];

// The Character._id prefix marking an NPC minted from this catalog. A uuid can
// never start with this, so player and NPC ids cannot collide.
const NPC_CHARACTER_PREFIX = 'npc-';

/** The stable Character._id an NPC is seeded under (the idempotency key). */
export function npcCharacterId(npcId: string): string {
   return `${NPC_CHARACTER_PREFIX}${npcId}`;
}

/** The roster id behind a character id — null for player characters and for
 *  NPCs whose roster entry was retired (D10 rule 3: degrade, don't crash). */
export function npcIdFromCharacter(characterId: string): NpcId | null {
   if (!characterId.startsWith(NPC_CHARACTER_PREFIX))
      return null;

   const npcId = characterId.slice(NPC_CHARACTER_PREFIX.length);
   return npcId in NPCS ? npcId as NpcId : null;
}

/** Static roster data (archetype, home…) for a character id, or null. This is
 *  how runtime code reads an NPC's static half — it is never stored (D10). */
export function npcDefinition(characterId: string): NpcDefinition | null {
   const npcId = npcIdFromCharacter(characterId);
   return npcId ? NPCS[npcId] : null;
}
