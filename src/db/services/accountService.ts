import { Account, type AccountDoc } from '../models/account.js';
import { characterService } from './characterService.js';
import { activitySessionService } from './activitySessionService.js';
import type { CharacterDoc } from '../models/character.js';
import type { CharacterLockManager } from '../../core/locks.js';

export type SwitchResult =
   | { ok: true }
   | { ok: false; reason: 'not-owned' | 'current-busy' | 'target-busy' };

export const accountService = {
   /** Returns the account, creating it (plus a starter draft character) on first
    *  contact. Always refreshes the cached username. */
   async getOrCreate(userId: string, username: string): Promise<AccountDoc> {
      const account = await Account.findOneAndUpdate(
         { _id: userId },
         { $set: { username }, $setOnInsert: { activeCharacterId: null } },
         { upsert: true, new: true },
      ).lean<AccountDoc>();

      if (account.activeCharacterId)
         return account;

      // First contact: give the account a starter draft character. The
      // null-guarded claim keeps two concurrent first contacts from attaching
      // two starters — the loser discards its orphan and takes the winner's.
      const starter = await characterService.createStarter(userId, username);
      const claimed = await Account.findOneAndUpdate(
         { _id: userId, activeCharacterId: null },
         { $set: { activeCharacterId: starter._id } },
         { new: true },
      ).lean<AccountDoc>();

      if (claimed)
         return claimed;

      await characterService.remove(starter._id);
      return (await Account.findById(userId).lean<AccountDoc>())!;
   },

   /** The character the user is currently controlling (auto-creates on first contact). */
   async getActiveCharacter(userId: string, username: string): Promise<CharacterDoc | null> {
      const account = await this.getOrCreate(userId, username);
      return account.activeCharacterId ? characterService.get(account.activeCharacterId) : null;
   },

   /** Read-only sibling of `getActiveCharacter` for viewing OTHER people
    *  (`/profile`): never creates an account/starter as a side effect. */
   async peekActiveCharacter(userId: string): Promise<CharacterDoc | null> {
      const account = await Account.findById(userId).lean<AccountDoc>();
      return account?.activeCharacterId ? characterService.get(account.activeCharacterId) : null;
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
