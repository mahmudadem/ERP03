import { AccountingPolicyConfig } from '../../../domain/accounting/policies/PostingPolicyTypes';

/**
 * IAccountingPolicyConfigProvider
 * 
 * Single interface for loading accounting policy configuration.
 * Implementations can read from Firestore, JSON files, environment vars, etc.
 * 
 * This abstraction future-proofs the system - config source can change
 * without affecting policy logic or use cases.
 */
export interface IAccountingPolicyConfigProvider {
  /**
   * Get accounting policy configuration for a company
   * 
   * @param companyId - Company identifier
   * @returns Policy configuration or default config if not found
   */
  getConfig(companyId: string): Promise<AccountingPolicyConfig>;
}
