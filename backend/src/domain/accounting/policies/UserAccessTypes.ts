/**
 * User Access Control Types
 * 
 * Defines the access scope model for account-level restrictions.
 * Used by AccountAccessPolicy to enforce operational safety.
 */

/**
 * User access scope defining which accounts a user can post to
 */
export interface UserAccessScope {
  /**
   * List of unit/branch IDs the user has access to
   * e.g., ["branch-a", "dept-finance"]
   */
  allowedUnitIds: string[];

  /**
   * Super user flag - bypasses all account restrictions
   * Typically for admins or system users
   */
  isSuper?: boolean;
}

/**
 * Account ownership scope
 */
export type AccountOwnerScope = 'shared' | 'restricted';

/**
 * Account ownership metadata
 * Added to Account entity for access control
 */
export interface AccountOwnershipMetadata {
  /**
   * Units/branches that own this account
   * Only users with matching allowedUnitIds can post
   */
  ownerUnitIds?: string[];

  /**
   * Ownership scope
   * - "shared": accessible to all users
   * - "restricted": only accessible to users with matching unitIds
   */
  ownerScope?: AccountOwnerScope;
}
