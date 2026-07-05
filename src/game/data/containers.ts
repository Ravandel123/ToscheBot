// Storage containers (D33) — static content in code (D10): the places a
// character can stash owned-but-not-carried items, away from the encumbered
// pack. The DB stores only Item instances referencing a container by this
// stable slug; the container's name/emoji/description resolve from here.
//
// ADDING A CONTAINER = one entry here (+ wherever it becomes reachable). Ids are
// append-only (D10): they live in Item docs and ride in customIds. Access is not
// location-gated yet (prototype) — every container is reachable via `/stash`;
// tying a container to a place/hub action is a future step.

export interface StorageContainerDefinition {
   name: string;
   emoji: string;
   /** Short in-character line shown atop the stash panel. */
   description: string;
}

export const STORAGE_CONTAINERS = {
   home_chest: {
      name: 'Home Chest',
      emoji: '🗄️',
      description: 'A stout, iron-banded chest. Whatever you cannot carry waits here for you.',
   },
} as const satisfies Record<string, StorageContainerDefinition>;

export type StorageContainerId = keyof typeof STORAGE_CONTAINERS;

export const STORAGE_CONTAINER_IDS = Object.keys(STORAGE_CONTAINERS) as StorageContainerId[];

/** Where a `Store` action drops items until a per-location container map exists. */
export const DEFAULT_CONTAINER: StorageContainerId = 'home_chest';

export function isStorageContainerId(id: string): id is StorageContainerId {
   return id in STORAGE_CONTAINERS;
}

/** Resolves a stored container id, tolerating unknown ones (D10 rule 3). */
export function containerDefinition(id: string): StorageContainerDefinition | null {
   return isStorageContainerId(id) ? STORAGE_CONTAINERS[id] : null;
}
