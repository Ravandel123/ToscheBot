import { Account, accountSettings, type AccountDoc, type AccountSettings } from '../models/account.js';
import { characterService } from './characterService.js';
import { activitySessionService } from './activitySessionService.js';
import type { CharacterDoc } from '../models/character.js';
import type { CharacterLockManager } from '../../core/locks.js';

export type SwitchResult =
   | { ok: true }
   | { ok: false; reason: 'not-owned' | 'current-busy' | 'target-busy' };

export const accountService = {
   /** Returns the account, creating a bare one on first contact (no characters —
    *  the first draft only exists once the player runs `/character create`).
    *  Always refreshes the cached username. */
   async getOrCreate(userId: string, username: string): Promise<AccountDoc> {
      return Account.findOneAndUpdate(
         { _id: userId },
         { $set: { username }, $setOnInsert: { activeCharacterId: null } },
         { upsert: true, returnDocument: 'after' },
      ).lean<AccountDoc>();
   },

   /** The character the user is currently controlling (null until they create one). */
   async getActiveCharacter(userId: string, username: string): Promise<CharacterDoc | null> {
      const account = await this.getOrCreate(userId, username);
      return account.activeCharacterId ? characterService.get(account.activeCharacterId) : null;
   },

   /** Read-only sibling of `getActiveCharacter` for viewing OTHER people
    *  (`/character view`): never creates an account as a side effect. */
   async peekActiveCharacter(userId: string): Promise<CharacterDoc | null> {
      const account = await Account.findById(userId).lean<AccountDoc>();
      return account?.activeCharacterId ? characterService.get(account.activeCharacterId) : null;
   },

   /** The player's account settings, with defaults for pre-D27 docs / no account. */
   async getSettings(userId: string): Promise<AccountSettings> {
      const account = await Account.findById(userId).lean<AccountDoc>();
      return accountSettings(account);
   },

   /** Flips one account setting. Returns the updated settings (with defaults). */
   async updateSetting(userId: string, key: keyof AccountSettings, value: boolean): Promise<AccountSettings> {
      const account = await Account.findOneAndUpdate(
         { _id: userId },
         { $set: { [`settings.${key}`]: value } },
         { returnDocument: 'after' },
      ).lean<AccountDoc>();

      return accountSettings(account);
   },

   /**
    * Switches the active character, enforcing the restrictions (D13): you may
    * only activate your own character, and neither the current nor the target
    * character may be busy — in-memory locked (mid-fight) OR in a durable
    * activity session (mid-climb, survives restarts — D17/D22). This guard is
    * what enforces "one user, one live activity at a time". A 0-HP or
    * unapproved character CAN be made active (just can't act).
    */
   async setActiveCharacter(userId: string, username: string, characterId: string, locks: CharacterLockManager): Promise<SwitchResult> {
      const target = await characterService.get(characterId);
      if (!target || target.ownerId !== userId)
         return { ok: false, reason: 'not-owned' };

      const account = await this.getOrCreate(userId, username);
      if (account.activeCharacterId && await isCharacterBusy(account.activeCharacterId, locks))
         return { ok: false, reason: 'current-busy' };
      if (await isCharacterBusy(characterId, locks))
         return { ok: false, reason: 'target-busy' };

      await Account.updateOne({ _id: userId }, { $set: { activeCharacterId: characterId } });
      return { ok: true };
   },
};

async function isCharacterBusy(characterId: string, locks: CharacterLockManager): Promise<boolean> {
   if (locks.isLocked(characterId))
      return true;

   return await activitySessionService.getActiveForParticipant(characterId) !== null;
}
