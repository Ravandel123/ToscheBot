// Pure step logic for the 'dialogue' activity (R14/D45) — no Discord, no DB.
// A conversation is a graph walk over game/data/dialogues.ts: each pick
// resolves one option (sometimes a d100 roll-under check), applies its
// session-scoped effects and moves to the outcome's node — or ends the talk.
// Mirrors challenge.ts: flavor + roll summary ride IN the state so repaints
// are stable; the terminal outcome is DERIVED-then-STORED (`resolution`) so a
// crash between the final step-commit and the completion tail is recoverable.
//
// Two deliberate v1 shapes (conversations.md):
//   * flags and the trait SNAPSHOT live in session state only — flags die with
//     the conversation (durable quest flags = an owner decision), and the
//     snapshot exists so gate evaluation stays pure on repaints; the DB's
//     `applyTraitDeltas` write remains the authoritative trait record.
//   * the NPC is NOT a session participant — talking never makes the NPC busy
//     (one player mid-chat must not lock the tavern for everyone else); the
//     NPC id rides in state for rendering and presence re-checks.
import { checkTarget, type CheckSubject } from '../checks.js';
import { DIALOGUE_END, DIALOGUES, WORK_LINES, type DialogueDefinition, type DialogueNode, type DialogueOption, type DialogueOutcome } from '../data/dialogues.js';
import { npcDefinition } from '../data/npcs.js';
import { TRAITS, type TraitKey } from '../data/traits.js';

/** 🟡 AP charged when an option ROLLS its check (checkless lines are free —
 *  conversations.md: talk is cheap, a check is a meaningful action). Symmetric
 *  with FORAGE_AP_COST so speechcraft training is priced like gathering. */
export const DIALOGUE_CHECK_AP_COST = 1;

export interface DialogueState {
   /** → DialogueId; resolved gracefully at read time (D10 rule 3). */
   dialogueId: string;
   /** Who is being talked to — for rendering, never a participant (see above). */
   npcCharacterId: string;
   nodeId: string;
   /** Session-scoped flags set by picked options (gate later branches). */
   flags: string[];
   /** One-shot options already picked (`node.option` keys — their buttons go). */
   spentOptionKeys: string[];
   /** The talker's deed traits, snapshot at start and kept current by in-session
    *  effects — gates evaluate against THIS, purely, on every repaint. */
   traits: Partial<Record<TraitKey, number>>;
   /** Per-option d100 targets (`node.option` keys), computed when the session
    *  opens — the stateless panel shows honest % without re-reading the character. */
   optionTargets: Record<string, number>;
   /** Flavor + roll summary of the latest pick (replay-safe: part of the state). */
   lastLine: string;
   /** '' while talking; 'ended' once a pick routes to DIALOGUE_END. */
   resolution: '' | 'ended';
}

export type DialogueProgress = 'ongoing' | 'ended';

export type DialogueGateCheck = { ok: true } | { ok: false; reason: string };

/** An option as the panel sees it: available, or visible-but-locked with why. */
export interface AvailableDialogueOption {
   option: DialogueOption;
   ok: boolean;
   reason?: string;
}

/** A missing `failure` on a rolled option ends the talk rather than crashing. */
const FALLBACK_FAILURE: DialogueOutcome = { next: DIALOGUE_END, lines: ['The conversation trails off.'] };

/** Reads a DialogueState back from the session's opaque `state` blob, tolerating
 *  missing/malformed fields (an old or hand-edited session must not crash the bot). */
export function dialogueStateFrom(blob: Record<string, unknown>): DialogueState {
   const str = (v: unknown): string => (typeof v === 'string' ? v : '');
   const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((entry): entry is string => typeof entry === 'string') : []);

   const targets: Record<string, number> = {};
   if (blob.optionTargets && typeof blob.optionTargets === 'object')
      for (const [key, value] of Object.entries(blob.optionTargets))
         if (typeof value === 'number' && Number.isFinite(value))
            targets[key] = value;

   const traits: Partial<Record<TraitKey, number>> = {};
   if (blob.traits && typeof blob.traits === 'object')
      for (const [key, value] of Object.entries(blob.traits))
         if (key in TRAITS && typeof value === 'number' && Number.isFinite(value))
            traits[key as TraitKey] = value;

   return {
      dialogueId: str(blob.dialogueId),
      npcCharacterId: str(blob.npcCharacterId),
      nodeId: str(blob.nodeId),
      flags: strings(blob.flags),
      spentOptionKeys: strings(blob.spentOptionKeys),
      traits,
      optionTargets: targets,
      lastLine: str(blob.lastLine),
      resolution: blob.resolution === 'ended' ? 'ended' : '',
   };
}

export function initialDialogueState(
   dialogueId: string,
   npcCharacterId: string,
   startNodeId: string,
   traits: Partial<Record<TraitKey, number>>,
   optionTargets: Record<string, number>,
): DialogueState {
   return {
      dialogueId,
      npcCharacterId,
      nodeId: startNodeId,
      flags: [],
      spentOptionKeys: [],
      traits: { ...traits },
      optionTargets,
      lastLine: '',
      resolution: '',
   };
}

/** The `optionTargets`/`spentOptionKeys` key — option ids are only unique
 *  within their node, so the node scopes them ('.' is customId-safe but these
 *  keys never ride one; only the bare option id does). */
export function dialogueOptionKey(nodeId: string, optionId: string): string {
   return `${nodeId}.${optionId}`;
}

/** Every rolled option's d100 target across the WHOLE graph, computed from the
 *  live (equipment-modified) talker when the session opens (the D26 honest-%
 *  discipline). Graphs are small, so precomputing all nodes is cheap. */
export function computeDialogueTargets(subject: CheckSubject, dialogue: DialogueDefinition): Record<string, number> {
   return Object.fromEntries(
      Object.entries(dialogue.nodes).flatMap(([nodeId, node]) =>
         node.options.flatMap((option) =>
            option.check ? [[dialogueOptionKey(nodeId, option.id), checkTarget(subject, option.check)] as const] : []),
      ),
   );
}

/** The dialogue behind a state, if the catalog still has it (D10 rule 3). */
export function dialogueOf(state: DialogueState): DialogueDefinition | null {
   return DIALOGUES[state.dialogueId as keyof typeof DIALOGUES] ?? null;
}

/** The state's current node, or null when the dialogue/node id no longer
 *  resolves (a renamed catalog entry — callers degrade to an ended view). */
export function dialogueNodeOf(state: DialogueState): DialogueNode | null {
   return dialogueOf(state)?.nodes[state.nodeId] ?? null;
}

/** Whether an option's gate holds against the session's flags + trait snapshot. */
export function dialogueGateCheck(option: DialogueOption, state: DialogueState): DialogueGateCheck {
   const gate = option.requires;
   if (!gate)
      return { ok: true };

   const flagsMissing = (gate.flags ?? []).some((flag) => !state.flags.includes(flag));
   const traitsShort = Object.entries(gate.minTraits ?? {}).some(([key, min]) => (state.traits[key as TraitKey] ?? 0) < (min ?? 0));

   return flagsMissing || traitsShort ? { ok: false, reason: gate.reason } : { ok: true };
}

/** The options the panel shows for a node: spent one-shots and unmet hidden
 *  options are dropped; unmet visible ones stay, locked with their reason. */
export function availableDialogueOptions(nodeId: string, node: DialogueNode, state: DialogueState): AvailableDialogueOption[] {
   return node.options.flatMap((option): AvailableDialogueOption[] => {
      if (state.spentOptionKeys.includes(dialogueOptionKey(nodeId, option.id)))
         return [];

      const gate = dialogueGateCheck(option, state);
      if (gate.ok)
         return [{ option, ok: true }];
      if (option.hidden)
         return [];
      return [{ option, ok: false, reason: gate.reason }];
   });
}

/** Which outcome a picked option lands on (checkless options always succeed). */
export function appliedDialogueOutcome(option: DialogueOption, success: boolean): DialogueOutcome {
   if (!option.check || success)
      return option.success;

   return option.failure ?? FALLBACK_FAILURE;
}

/**
 * One picked option. Pure: the caller rolls the check and picks the flavor line
 * (injectable in tests). Applies the outcome's session-side effects — flags,
 * the trait snapshot (clamped ≥ 0, mirroring `applyTraitDeltas`) — burns a
 * one-shot, and either moves to the next node or resolves the conversation.
 */
export function pickDialogueOption(
   state: DialogueState,
   nodeId: string,
   option: DialogueOption,
   success: boolean,
   line: string,
): DialogueState {
   const outcome = appliedDialogueOutcome(option, success);
   const effects = outcome.effects;

   const traits = { ...state.traits };
   for (const [key, delta] of Object.entries(effects?.traits ?? {}))
      traits[key as TraitKey] = Math.max(0, (traits[key as TraitKey] ?? 0) + (delta ?? 0));

   const flags = [...new Set([...state.flags, ...(effects?.flags ?? [])])];
   const spentOptionKeys = option.oneShot
      ? [...state.spentOptionKeys, dialogueOptionKey(nodeId, option.id)]
      : state.spentOptionKeys;

   const ended = outcome.next === DIALOGUE_END;
   return {
      ...state,
      nodeId: ended ? state.nodeId : outcome.next,
      flags,
      spentOptionKeys,
      traits,
      lastLine: line,
      resolution: ended ? 'ended' : '',
   };
}

/** The progress is DERIVED from state — re-entry after a crash sees a terminal
 *  state and offers to finish the idempotent completion tail. */
export function dialogueProgress(state: DialogueState): DialogueProgress {
   return state.resolution === '' ? 'ongoing' : 'ended';
}

/** Fills the {npc}/{epithet}/{work} placeholders from the roster catalog —
 *  unknown NPCs (a retired entry) degrade to neutral stand-ins, never a crash. */
export function fillDialogueLine(line: string, npcCharacterId: string): string {
   const npc = npcDefinition(npcCharacterId);

   return line
      .replaceAll('{npc}', npc?.name ?? 'The stranger')
      .replaceAll('{epithet}', npc?.epithet ?? 'a face in the crowd')
      .replaceAll('{work}', npc ? WORK_LINES[npc.archetype] : '"A little of this, a little of that."');
}
