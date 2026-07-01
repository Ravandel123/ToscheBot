import { Account, type AccountDoc } from '../models/account.js';
import { characterService } from './characterService.js';
import type { CharacterDoc } from '../models/character.js';
import type { PlayerLockManager } from '../../core/locks.js';

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

      // First contact: give the account a starter draft character.
      const starter = await characterService.createStarter(userId, username);
      await Account.updateOne({ _id: userId }, { $set: { activeCharacterId: starter._id } });
      return { ...account, activeCharacterId: starter._id };
   },

   /** The character the user is currently controlling (auto-creates on first contact). */
   async getActiveCharacter(userId: string, username: string): Promise<CharacterDoc | null> {
      const account = await this.getOrCreate(userId, username);
      return account.activeCharacterId ? characterService.get(account.activeCharacterId) : null;
   },

   /**
    * Switches the active character, enforcing the restrictions (D13): you may
    * only activate your own character, and neither the current nor the target
    * character may be locked (mid-fight/activity). A 0-HP or unapproved
    * character CAN be made active (just can't act).
    */
   async setActiveCharacter(userId: string, username: string, characterId: string, locks: PlayerLockManager): Promise<SwitchResult> {
      const target = await characterService.get(characterId);
      if (!target || target.ownerId !== userId)
         return { ok: false, reason: 'not-owned' };

      const account = await this.getOrCreate(userId, username);
      if (account.activeCharacterId && locks.isLocked(account.activeCharacterId))
         return { ok: false, reason: 'current-busy' };
      if (locks.isLocked(characterId))
         return { ok: false, reason: 'target-busy' };

      await Account.updateOne({ _id: userId }, { $set: { activeCharacterId: characterId } });
      return { ok: true };
   },
};
