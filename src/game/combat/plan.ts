import { FIGHTING_STYLES, isFightingStyleId, type FightingStyleId, type StyleFamily } from './styles.js';

// The combat plan (D41, the owner's idea) — a character's standing orders for
// auto-resolved fights, set ahead of time on the `/character combat` panel.
// In an async game the fight rolls itself (combat.md R24), so a plan IS the
// player's agency: a default style per family plus conditional switches
// ("below 50% Health go Stonewall") evaluated at the top of every exchange.
// FF12-gambit shaped, deliberately tiny: one flat rule list, first match wins.
//
// All triggers are MONOTONIC within a fight (own/foe Health only falls, the
// round only rises), so a fired rule stays fired — a fight changes style at
// most a few times and never flaps. Pure — no Discord, no DB.

export type PlanTriggerKind = 'self-health-below' | 'foe-health-below' | 'round-at-least';

export interface PlanTrigger {
   kind: PlanTriggerKind;
   /** A percent (health triggers) or a 1-based round number. */
   value: number;
}

export interface PlanRule {
   trigger: PlanTrigger;
   style: FightingStyleId;
}

/** One family's standing orders: the default style (null = fight plain, the
 *  pre-D41 behavior) plus up to MAX_PLAN_RULES conditional switches. */
export interface FamilyPlan {
   style: FightingStyleId | null;
   rules: PlanRule[];
}

/** What a character stores (`Character.combatPlan`): one plan per family they
 *  have configured. Sparse — an absent family fights plain. */
export type CombatPlan = Partial<Record<StyleFamily, FamilyPlan>>;

export const MAX_PLAN_RULES = 3;

export function emptyFamilyPlan(): FamilyPlan {
   return { style: null, rules: [] };
}

/** The snapshot a rule is checked against, at the top of one exchange. */
export interface PlanContext {
   /** 1-based exchange number. */
   round: number;
   selfHealthPercent: number;
   foeHealthPercent: number;
}

/** The style in effect right now: the FIRST rule whose trigger fires (list
 *  order = priority), else the plan's default. */
export function activePlanStyle(plan: FamilyPlan, ctx: PlanContext): FightingStyleId | null {
   for (const rule of plan.rules)
      if (triggerFires(rule.trigger, ctx))
         return rule.style;

   return plan.style;
}

function triggerFires(trigger: PlanTrigger, ctx: PlanContext): boolean {
   switch (trigger.kind) {
      case 'self-health-below': return ctx.selfHealthPercent < trigger.value;
      case 'foe-health-below': return ctx.foeHealthPercent < trigger.value;
      case 'round-at-least': return ctx.round >= trigger.value;
   }
}

const TRIGGER_KINDS: readonly PlanTriggerKind[] = ['self-health-below', 'foe-health-below', 'round-at-least'];

export function isPlanTriggerKind(kind: string): kind is PlanTriggerKind {
   return (TRIGGER_KINDS as readonly string[]).includes(kind);
}

/** Human line for a trigger (panel + narration helpers). */
export function describeTrigger(trigger: PlanTrigger): string {
   switch (trigger.kind) {
      case 'self-health-below': return `my Health below ${trigger.value}%`;
      case 'foe-health-below': return `foe's Health below ${trigger.value}%`;
      case 'round-at-least': return `from round ${trigger.value}`;
   }
}

/**
 * Defensive read of a stored/authored family plan (D10 rule 3): unknown or
 * wrong-family style ids drop out (a renamed style must never crash a fight),
 * trigger values clamp to sane bounds, rules cap at MAX_PLAN_RULES. Junk shapes
 * degrade to the empty plan.
 */
export function sanitizeFamilyPlan(raw: unknown, family: StyleFamily): FamilyPlan {
   if (typeof raw !== 'object' || raw === null)
      return emptyFamilyPlan();

   const plan = raw as { style?: unknown; rules?: unknown };
   const style = sanitizeStyle(plan.style, family);

   const rules: PlanRule[] = [];
   if (Array.isArray(plan.rules))
      for (const entry of plan.rules) {
         const rule = sanitizeRule(entry, family);
         if (rule)
            rules.push(rule);
         if (rules.length >= MAX_PLAN_RULES)
            break;
      }

   return { style, rules };
}

function sanitizeStyle(raw: unknown, family: StyleFamily): FightingStyleId | null {
   if (typeof raw !== 'string' || !isFightingStyleId(raw))
      return null;

   return FIGHTING_STYLES[raw].family === family ? raw : null;
}

function sanitizeRule(raw: unknown, family: StyleFamily): PlanRule | null {
   if (typeof raw !== 'object' || raw === null)
      return null;

   const entry = raw as { trigger?: { kind?: unknown; value?: unknown }; style?: unknown };
   const style = sanitizeStyle(entry.style, family);
   const kind = entry.trigger?.kind;
   const value = entry.trigger?.value;

   if (!style || typeof kind !== 'string' || !isPlanTriggerKind(kind) || typeof value !== 'number' || !Number.isFinite(value))
      return null;

   // Percents live in (0,100); a round trigger needs a sane round — one clamp fits both.
   const clamped = Math.max(1, Math.min(99, Math.round(value)));
   return { trigger: { kind, value: clamped }, style };
}
