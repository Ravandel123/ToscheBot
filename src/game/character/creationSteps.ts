import { GENDER_CHOICES, NAME_MIN_LENGTH } from './identity.js';
import { CREATION_ATTRIBUTE_POINTS, allocationFrom, isAllocationComplete, pointsSpent } from './attributes.js';
import { RACES } from '../data/races.js';
import type { CharacterDoc } from '../../db/models/character.js';

// The step catalog driving the character-creation wizard (D20). The panel
// renders FROM this list (checklist, step picker, Continue target, Submit
// gate), so adding a creation step is one entry here + one renderer case in
// `_characterPanel.ts` (select steps) or a modal builder (modal steps).
//
// There is deliberately NO stored "current step" cursor: the draft Character
// doc itself is the wizard state, and progress is derived from which fields
// are filled. That is what makes the wizard interruptible and resumable across
// restarts for free (stateless panel + DB draft), with nothing to desync.

export type CreationStepKind = 'modal' | 'select';

export interface CreationStep {
   /** Stable slug; rides in customIds (`character:panel-step` values). */
   id: string;
   /** Label on the checklist and the step picker. */
   title: string;
   /** Which Discord surface edits this step (modal = free text, select = a list). */
   kind: CreationStepKind;
   /** Required steps gate Submit; optional ones only feed the checklist/Continue. */
   required: boolean;
   isComplete(character: CharacterDoc): boolean;
   /** Short current-value summary for the checklist ('—' when unset). */
   summary(character: CharacterDoc): string;
}

export const CREATION_STEPS: readonly CreationStep[] = [
   {
      id: 'details',
      title: 'Name & story',
      kind: 'modal',
      required: true,
      isComplete: (c) => c.identity.name.trim().length >= NAME_MIN_LENGTH,
      summary: (c) => c.identity.name.trim() || '—',
   },
   {
      id: 'race',
      title: 'Race',
      kind: 'select',
      required: true,
      isComplete: (c) => c.identity.race !== null,
      summary: (c) => (c.identity.race ? RACES[c.identity.race].name : '—'),
   },
   {
      id: 'gender',
      title: 'Gender',
      kind: 'select',
      required: true,
      isComplete: (c) => GENDER_CHOICES.some((g) => g.value === c.identity.gender),
      summary: (c) => GENDER_CHOICES.find((g) => g.value === c.identity.gender)?.label ?? '—',
   },
   {
      // The creation point-buy (D25): distribute CREATION_ATTRIBUTE_POINTS on
      // top of the racial base, max MAX_POINTS_PER_ATTRIBUTE on any one
      // attribute. Done only when every point is spent.
      id: 'attributes',
      title: 'Attributes',
      kind: 'select',
      required: true,
      isComplete: (c) => isAllocationComplete(allocationFrom(c.attributeAllocation)),
      summary: (c) => `${pointsSpent(allocationFrom(c.attributeAllocation))}/${CREATION_ATTRIBUTE_POINTS} points assigned`,
   },
];

export function creationStep(id: string): CreationStep | undefined {
   return CREATION_STEPS.find((step) => step.id === id);
}

/** Where "Continue" jumps: the first unfinished step in catalog order (optional ones included). */
export function firstIncompleteStep(character: CharacterDoc): CreationStep | undefined {
   return CREATION_STEPS.find((step) => !step.isComplete(character));
}

/** Whether every REQUIRED step is done — the Submit gate (`canSubmit` consumes this). */
export function requiredStepsComplete(character: CharacterDoc): boolean {
   return CREATION_STEPS.every((step) => !step.required || step.isComplete(character));
}
