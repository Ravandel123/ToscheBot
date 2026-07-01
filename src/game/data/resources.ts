// Vitals tracked per player. Each is stored as { current, max } and clamped
// to [0, max] on every write (D6). `regenPerHour` drives the hourly regen cron.
// Phase 2 ships the two core vitals; meters that *rise* over time (hunger,
// stress) have different tick semantics and are added later.

export interface ResourceDefinition {
   name: string;
   defaultMax: number;
   regenPerHour: number;
}

export const RESOURCES = {
   health: { name: 'Health', defaultMax: 20, regenPerHour: 2 },
   stamina: { name: 'Stamina', defaultMax: 10, regenPerHour: 5 },
} as const satisfies Record<string, ResourceDefinition>;

export type ResourceKey = keyof typeof RESOURCES;
