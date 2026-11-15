// Vitals tracked per player. Each is stored as { current, max } and clamped
// to [0, max] on every write. `regenPerHour` drives the hourly regen cron.
// Only the two core vitals exist; meters that *rise* over time (hunger,
// stress) have different tick semantics and get their own job when built.

export interface ResourceDefinition {
   name: string;
   /** Reference value at neutral (25-in-everything) attributes — kept for
    *  display/tuning context. The actual stored max is attribute-derived
    *  (`game/character/resources.ts`'s `recalculateMaxResources`), not this flat number. */
   defaultMax: number;
   regenPerHour: number;
   /** Whether the hourly regen still applies while the character is busy in a
    *  durable activity. Vitals pause — you don't heal mid-climb/mid-duel;
    *  Action Points are separate and ALWAYS accrue. */
   regenWhileBusy: boolean;
   /** Stored and regenerated, but not shown to players — nothing spends it yet. */
   hidden?: boolean;
}

export const RESOURCES = {
   health: { name: 'Health', defaultMax: 20, regenPerHour: 2, regenWhileBusy: false },
   stamina: { name: 'Stamina', defaultMax: 10, regenPerHour: 5, regenWhileBusy: false, hidden: true },
} as const satisfies Record<string, ResourceDefinition>;

export type ResourceKey = keyof typeof RESOURCES;

export const RESOURCE_KEYS = Object.keys(RESOURCES) as ResourceKey[];
