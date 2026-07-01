export class CooldownManager {
   // command key → user id → expiry timestamp (ms). Entries are overwritten
   // lazily on reuse instead of cleaned by timers; for a single guild the
   // map stays trivially small.
   private readonly expirations = new Map<string, Map<string, number>>();

   /**
    * Registers a use of `key` by `userId`. Returns 0 when allowed, otherwise
    * the remaining cooldown in seconds (and does not register the use).
    */
   use(key: string, userId: string, cooldownSeconds: number): number {
      if (cooldownSeconds <= 0)
         return 0;

      const now = Date.now();
      let perUser = this.expirations.get(key);

      if (!perUser) {
         perUser = new Map();
         this.expirations.set(key, perUser);
      }

      const expiresAt = perUser.get(userId) ?? 0;

      if (expiresAt > now)
         return (expiresAt - now) / 1000;

      perUser.set(userId, now + cooldownSeconds * 1000);
      return 0;
   }
}
