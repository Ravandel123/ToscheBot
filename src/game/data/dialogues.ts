import { npcDefinition, type NpcArchetype } from './npcs.js';
import type { CheckDefinition } from '../checks.js';
import type { TraitKey } from './traits.js';

// The dialogue catalog (R14/D45, conversations.md): a conversation is a graph
// of NODES — one NPC line + the player's OPTIONS — run as a durable 'dialogue'
// ActivitySession by the D22 registry (game/activity/dialogue.ts owns the pure
// step logic). Content-in-code (D10): ids are stable slugs riding in session
// state and `activity:opt:<sessionId>:<optionId>` customIds; the catalog test
// validates the graph (every `next` resolves, every node reachable, no dupes).
//
// Template-first (AUDIT §3.4): ONE reusable small-talk dialogue serves every
// archetype (greetings, rumors, a pointer to the NPC's function), so a new NPC
// talks for free; hand-authored trees are assigned per NPC via
// `NpcDefinition.dialogueId` and should stay few and GOOD (the authoring-cost
// risk in conversations.md). NPC lines may carry {npc}/{epithet}/{work}
// placeholders, filled at render time from the roster catalog.
//
// 🟡 Check modifiers and trait-delta sizes are balance placeholders.

export interface DialogueEffects {
   /** Deed-trait deltas the pick inflicts/earns (a cruel line → +cruelty). */
   traits?: Partial<Record<TraitKey, number>>;
   /** SESSION-scoped flags this outcome sets — they die with the conversation.
    *  Durable quest flags need an owner decision first (PLAN Decision queue). */
   flags?: readonly string[];
}

/** Where a picked option lands — and what it says on the way. */
export interface DialogueOutcome {
   /** Next node id, or 'end' — the conversation closes on this line. */
   next: string;
   /** One is picked at random when the outcome lands and stored in state, so
    *  repaints are stable (the challenge pattern). Shown above the next line. */
   lines?: readonly [string, ...string[]];
   effects?: DialogueEffects;
}

export interface DialogueGate {
   /** Session flags that must all be set (by earlier picks). */
   flags?: readonly string[];
   /** Deed-trait floors, judged against the talker (conversations.md's gates). */
   minTraits?: Partial<Record<TraitKey, number>>;
   /** Player-facing reason shown on a visible-but-locked option. */
   reason: string;
}

/** One line the player can say — a button on the dialogue panel. */
export interface DialogueOption {
   /** Stable slug, unique within its node; rides in customIds. */
   id: string;
   /** The player's line. Gated/rolled options carry a [Tag] by convention. */
   label: string;
   emoji: string;
   requires?: DialogueGate;
   /** With a gate: true = invisible until met (a secret line); false/absent =
    *  shown locked with the gate's reason (the deep-layer contrast, R14). */
   hidden?: boolean;
   /** The d100 test this line rolls (Persuade, Intimidate…); omitted = it just
    *  lands (`success` applies). A rolled option costs DIALOGUE_CHECK_AP_COST
    *  and trains its node's path (D40) — success and failure alike. */
   check?: CheckDefinition;
   /** The option retires after being picked once (asked and answered). */
   oneShot?: boolean;
   success: DialogueOutcome;
   /** Required when `check` is set (test-validated). */
   failure?: DialogueOutcome;
}

export interface DialogueNode {
   /** The NPC's line. {npc}/{epithet}/{work} fill at render time. */
   line: string;
   options: readonly [DialogueOption, ...DialogueOption[]];
}

export interface DialogueDefinition {
   /** Entry node id. */
   start: string;
   nodes: Record<string, DialogueNode>;
}

/** The terminal `next` sentinel — never a node id. */
export const DIALOGUE_END = 'end';

// One line per archetype answering "what do you do here?" — the {work}
// placeholder, so the small-talk template points at each NPC's function
// without a bespoke tree (npcs.md's generic-extras tier).
export const WORK_LINES: Record<NpcArchetype, string> = {
   merchant: '"Trade is my calling. Wares in, coin out — the stalls keep daylight hours, so come by while the sun does the haggling for you."',
   guard: '"I hold a post and keep it held. A quiet watch is a good watch — help me keep it that way and we shall get along."',
   laborer: '"Honest work, dawn to dusk. The river and the green give what they give; somebody has to bring it in."',
   homebody: '"I keep my corner of Deltrada standing, is all. Not every duty carries a spear."',
   wanderer: '"I go where the questions are. Deltrada has more of them than it likes to admit."',
};

// Common farewell pool — shared by both trees' parting outcomes.
const FAREWELLS = ['"Safe roads."', '"Mind how you go."', '"Deltrada keeps the watchful. Off with you."'] as const;

export const DIALOGUES = {
   // === The reusable small-talk template (every archetype's default) ==========
   small_talk: {
      start: 'greet',
      nodes: {
         greet: {
            line: '{npc} turns to you. "Well met. Something on your mind, or just stretching your legs?"',
            options: [
               {
                  id: 'work',
                  label: 'Ask about their work',
                  emoji: '🛠️',
                  success: { next: 'working' },
               },
               {
                  id: 'rumor',
                  label: 'Ask for the latest word',
                  emoji: '🗣️',
                  success: {
                     next: 'gossip',
                     lines: [
                        '"They say moonlight catches on something in the riverbank reeds at night — old planks the river never quite swallowed."',
                        '"The Tankard\'s bards have been rehearsing. When the singing starts of an evening, it goes till the candles drown."',
                        '"Another bruiser limped down from the Spire ladder this week. The champions up there do not blunt their blows."',
                        '"The Tanglewood has been generous this season — but half of what it offers will empty your stomach the hard way. Know your caps before you bite."',
                        '"Corvas poles the crossing at dawn and dusk. Call his ferry a raft and the fare doubles — ask me how I know."',
                        '"Nazir remembers every price he ever quoted. Cheaper to argue with the river."',
                     ],
                  },
               },
               {
                  id: 'press',
                  label: '[Persuade] Press for what folk won\'t say aloud',
                  emoji: '🎭',
                  check: { node: 'persuade', modifier: -10 },
                  oneShot: true,
                  success: {
                     next: 'confide',
                     effects: { flags: ['confided'] },
                     lines: [
                        '"The Imperator has not taken an audience in weeks. The court says \'indisposed\'. The kitchens say the mead cellar is emptying fast."',
                        '"Dagna\'s watch roster has a gap in it, third bell past midnight. You did not hear that from me."',
                        '"Old Marrek pays for his mead with stories, but he keeps one he has never sold. Ask about the scar and watch his cup hand."',
                     ],
                  },
                  failure: {
                     next: 'rebuff',
                     lines: [
                        'They look you up and down, unmoved. "You will have to buy me more than words for that."',
                        'A slow shake of the head. "Curiosity like yours gets folk fined, friend."',
                     ],
                  },
               },
               {
                  id: 'farewell',
                  label: 'Take your leave',
                  emoji: '👋',
                  success: { next: DIALOGUE_END, lines: FAREWELLS },
               },
            ],
         },
         working: {
            line: '{work}',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'greet' } },
               { id: 'farewell', label: 'Take your leave', emoji: '👋', success: { next: DIALOGUE_END, lines: FAREWELLS } },
            ],
         },
         gossip: {
            line: '"That is the word going around, anyway. Make of it what you will."',
            options: [
               {
                  id: 'more',
                  label: 'And what else?',
                  emoji: '🗣️',
                  success: {
                     next: 'gossip',
                     lines: [
                        '"A patrol swears the fog on the west road had a shape in it. The sergeant fined them a day\'s mead for saying so."',
                        '"Somebody has been asking after wall measurements. Scholarly type. The guards pretend not to mind, and mind very much."',
                        '"Hazel of the Tanglewood has been wrong about a mushroom exactly once. Nobody who heard the story orders the stew."',
                     ],
                  },
               },
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'greet' } },
               { id: 'farewell', label: 'Take your leave', emoji: '👋', success: { next: DIALOGUE_END, lines: FAREWELLS } },
            ],
         },
         confide: {
            line: 'They lean back as if nothing had been said at all. "And that is all you get. Understand?"',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'greet' } },
               { id: 'farewell', label: 'Take your leave', emoji: '👋', success: { next: DIALOGUE_END, lines: FAREWELLS } },
            ],
         },
         rebuff: {
            line: '"Some things I keep behind my teeth. Ask me something else or don\'t."',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'greet' } },
               { id: 'farewell', label: 'Take your leave', emoji: '👋', success: { next: DIALOGUE_END, lines: FAREWELLS } },
            ],
         },
      },
   },

   // === The ONE authored named-NPC tree (S4's proof piece): Marrek, the Old
   // Campaigner — gates, checks, trait awards and a hidden line in ~8 nodes ====
   marrek_tales: {
      start: 'corner',
      nodes: {
         corner: {
            line: 'Marrek does not look up from his cup. "Sit or don\'t, pup. This table has heard every story I own and a few I borrowed."',
            options: [
               {
                  id: 'wall',
                  label: 'Ask about his thirty years on the wall',
                  emoji: '🧱',
                  success: { next: 'wall_years' },
               },
               {
                  id: 'scar',
                  label: '[Persuade] Ask for the true story of the scar — not the tavern one',
                  emoji: '🍺',
                  check: { node: 'persuade', modifier: -10 },
                  oneShot: true,
                  success: {
                     next: 'true_story',
                     effects: { flags: ['heard_truth'] },
                     lines: ['His cup stops halfway to his mouth. For a moment the corner table is very quiet.'],
                  },
                  failure: {
                     next: 'scoff',
                     lines: ['He barks a laugh that turns every head at the bar.'],
                  },
               },
               {
                  id: 'mock',
                  label: 'Tell him old men\'s war stories bore you',
                  emoji: '🐍',
                  oneShot: true,
                  success: {
                     next: 'bristled',
                     effects: { traits: { cruelty: 1 } },
                     lines: ['The words land meaner than they left your mouth.'],
                  },
               },
               {
                  id: 'swap',
                  label: '[Courage] Swap him a story of your own — the day you did not run',
                  emoji: '🦁',
                  requires: { minTraits: { courage: 1 }, reason: 'he trades true stories only for true ones — face something first' },
                  oneShot: true,
                  success: {
                     next: 'respect',
                     effects: { flags: ['swapped_story'] },
                  },
               },
               {
                  id: 'toast',
                  label: 'Raise your cup to the ones who did not come back',
                  emoji: '🍻',
                  requires: { flags: ['heard_truth'], reason: 'you would not yet know what to drink to' },
                  hidden: true,
                  oneShot: true,
                  success: {
                     next: 'toast_answered',
                     effects: { traits: { honor: 1 } },
                  },
               },
               {
                  id: 'leave',
                  label: 'Leave him to his cup',
                  emoji: '👋',
                  success: {
                     next: DIALOGUE_END,
                     lines: ['"Keep your shield up, pup."', '"Off with you, then. Some of us have drinking to do."'],
                  },
               },
            ],
         },
         wall_years: {
            line: '"Thirty years of rain, fog and other people\'s dignitaries." He turns his cup slowly. "You want the truth of the wall? Most days nothing happens. You stand there so that it keeps not happening. Hardest work I ever did."',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'corner' } },
               { id: 'leave', label: 'Leave him to his cup', emoji: '👋', success: { next: DIALOGUE_END, lines: ['"Mind the quiet ones, pup."'] } },
            ],
         },
         true_story: {
            line: '"No ermehn gave me this." His thumb traces the scar along his jaw. "Winter road, a cart axle snapped, and the man beside me caught the worse half of it. I wear it like a battle scar because the truth buys no mead. Now you know what it cost him — see you spend it better."',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'corner' } },
               { id: 'leave', label: 'Leave him to his cup', emoji: '👋', success: { next: DIALOGUE_END, lines: ['"That story stays at this table, pup."'] } },
            ],
         },
         scoff: {
            line: '"Hah! You will have to be quicker in the mud than you are with words." He waves you off with two fingers. "The tavern version is better anyway. Ask me something else."',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'corner' } },
               { id: 'leave', label: 'Leave him to his cup', emoji: '👋', success: { next: DIALOGUE_END, lines: ['"Come back with better manners or better mead."'] } },
            ],
         },
         bristled: {
            line: 'His scarred hand flattens on the table, slow and deliberate. "Bore you, do they. The wall bored ME for thirty years — and that is why your roof has never burned. Sit down or move along."',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'corner' } },
               { id: 'leave', label: 'Leave him to his cup', emoji: '👋', success: { next: DIALOGUE_END, lines: ['He does not look up as you go.'] } },
            ],
         },
         respect: {
            line: 'He listens without a word, all the way through, and does not reach for his cup once. "Hm. Maybe this table has room for one more after all." He pushes the bench out with his boot.',
            options: [
               { id: 'back', label: 'Ask about something else', emoji: '↩️', success: { next: 'corner' } },
               { id: 'leave', label: 'Take the compliment and go', emoji: '👋', success: { next: DIALOGUE_END, lines: ['"Keep that story straight. It is worth more told true."'] } },
            ],
         },
         toast_answered: {
            line: 'Marrek looks at you a long moment, then lifts his cup without a word. "To the ones on the wall." He drinks, and for once tells no story at all.',
            options: [
               { id: 'back', label: 'Sit with him a while, then ask on', emoji: '↩️', success: { next: 'corner' } },
               { id: 'leave', label: 'Leave him to his memories', emoji: '👋', success: { next: DIALOGUE_END, lines: ['You leave the corner table quieter than you found it.'] } },
            ],
         },
      },
   },
} as const satisfies Record<string, DialogueDefinition>;

export type DialogueId = keyof typeof DIALOGUES;

export const DIALOGUE_IDS = Object.keys(DIALOGUES) as DialogueId[];

/** Every archetype's default conversation — the template tier (npcs.md). */
export const ARCHETYPE_DIALOGUES: Record<NpcArchetype, DialogueId> = {
   merchant: 'small_talk',
   guard: 'small_talk',
   laborer: 'small_talk',
   homebody: 'small_talk',
   wanderer: 'small_talk',
};

/** Type guard for an id read off session state (D10 rule 3). */
export function isDialogueId(id: string): id is DialogueId {
   return id in DIALOGUES;
}

/** The dialogue an NPC hosts: its authored tree if assigned, else its
 *  archetype's small talk; null for non-NPCs and retired roster entries —
 *  callers treat null as "nothing to say" (D10 rule 3). */
export function dialogueIdFor(npcCharacterId: string): DialogueId | null {
   const npc = npcDefinition(npcCharacterId);
   if (!npc)
      return null;

   const id = npc.dialogueId ?? ARCHETYPE_DIALOGUES[npc.archetype];
   return isDialogueId(id) ? id : null;
}
