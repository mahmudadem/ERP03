import { UserAccessScope } from '../../../domain/accounting/policies/UserAccessTypes';

/**
 * IUserAccessScopeProvider
 * 
 * Single interface for loading user access scope.
 * Implementations can read from Firestore user profiles, auth claims, etc.
 * 
 * This abstraction allows different sources without affecting policy logic.
 */
export interface IUserAccessScopeProvider {
  /**
   * Get user access scope for account restrictions
   * 
   * @param userId - User identifier
   * @param companyId - Company identifier (for context)
   * @returns User access scope with allowed units and super flag
   */
  getScope(userId: string, companyId: string): Promise<UserAccessScope>;
}
