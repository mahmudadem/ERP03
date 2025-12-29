import * as admin from 'firebase-admin';
import { IUserAccessScopeProvider } from './IUserAccessScopeProvider';
import { UserAccessScope } from '../../../domain/accounting/policies/UserAccessTypes';

/**
 * FirestoreUserAccessScopeProvider
 * 
 * Loads user access scope from Firestore user profile.
 * 
 * Storage location: users/{userId}/profile
 * 
 * Safe defaults:
 * - Missing profile → empty allowedUnitIds (denies restricted accounts)
 * - Missing fields → empty allowedUnitIds, isSuper = false
 */
export class FirestoreUserAccessScopeProvider implements IUserAccessScopeProvider {
  constructor(private readonly db: admin.firestore.Firestore) {}

  async getScope(userId: string, companyId: string): Promise<UserAccessScope> {
    try {
      const profileRef = this.db
        .collection('users')
        .doc(userId)
        .collection('profile')
        .doc('access');

      const snapshot = await profileRef.get();

      if (!snapshot.exists) {
        // Safe default: no access to restricted accounts
        return this.getDefaultScope();
      }

      const data = snapshot.data();
      if (!data) {
        return this.getDefaultScope();
      }

      return {
        allowedUnitIds: data.allowedUnitIds ?? [],
        isSuper: data.isSuper ?? false
      };
    } catch (error) {
      console.error(`Failed to load user scope for ${userId}:`, error);
      // Fail safe: deny restricted access
      return this.getDefaultScope();
    }
  }

  private getDefaultScope(): UserAccessScope {
    return {
      allowedUnitIds: [],
      isSuper: false
    };
  }
}
