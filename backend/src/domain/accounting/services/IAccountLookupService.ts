import { AccountOwnershipMetadata } from '../policies/UserAccessTypes';

/**
 * Account with ownership metadata for access control
 */
export interface AccountWithAccess {
  id: string;
  code: string;
  name: string;
  type: string; // Added to support AccountType-based policies
  ownerUnitIds?: string[];
  ownerScope?: 'shared' | 'restricted';
}

/**
 * IAccountLookupService
 * 
 * Provides efficient bulk account loading for access control checks.
 * Avoids N+1 queries by loading all required accounts at once.
 */
export interface IAccountLookupService {
  /**
   * Load multiple accounts by their IDs in a single query
   * 
   * @param companyId - Company identifier
   * @param accountIds - List of account IDs to load
   * @returns Map of accountId -> Account for fast lookup
   */
  getAccountsByIds(
    companyId: string,
    accountIds: string[]
  ): Promise<Map<string, AccountWithAccess>>;
}
