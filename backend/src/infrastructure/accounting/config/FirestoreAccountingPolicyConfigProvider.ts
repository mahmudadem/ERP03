import * as admin from 'firebase-admin';
import { IAccountingPolicyConfigProvider } from './IAccountingPolicyConfigProvider';
import { AccountingPolicyConfig } from '../../../domain/accounting/policies/PostingPolicyTypes';

/**
 * FirestoreAccountingPolicyConfigProvider
 * 
 * Loads accounting policy configuration from Firestore.
 * 
 * Storage location: companies/{companyId}/settings/accounting
 * 
 * This provider returns sensible defaults if config doesn't exist,
 * ensuring the system works even for new companies.
 */
export class FirestoreAccountingPolicyConfigProvider implements IAccountingPolicyConfigProvider {
  private readonly COLLECTION_PATH = 'companies';
  private readonly SETTINGS_DOC = 'settings';
  private readonly ACCOUNTING_FIELD = 'accounting';

  constructor(private readonly db: admin.firestore.Firestore) {}

  async getConfig(companyId: string): Promise<AccountingPolicyConfig> {
    try {
      const settingsRef = this.db
        .collection(this.COLLECTION_PATH)
        .doc(companyId)
        .collection(this.SETTINGS_DOC)
        .doc(this.ACCOUNTING_FIELD);

      const snapshot = await settingsRef.get();

      if (!snapshot.exists) {
        // Return default config (all policies disabled)
        return this.getDefaultConfig();
      }

      const data = snapshot.data();
      if (!data) {
        return this.getDefaultConfig();
      }

      // Merge with defaults to handle missing fields and ensure structural integrity
      return {
        ...this.getDefaultConfig(),
        ...data,
        // Override nested objects specifically if they exist to avoid partial merges
        costCenterPolicy: {
          ...(this.getDefaultConfig().costCenterPolicy),
          ...(data.costCenterPolicy || {})
        }
      };
    } catch (error) {
      console.error(`Failed to load policy config for company ${companyId}:`, error);
      // Fail safe: return default config
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): AccountingPolicyConfig {
    return {
      approvalRequired: false,
      periodLockEnabled: false,
      accountAccessEnabled: false,
      costCenterPolicy: {
        enabled: false,
        requiredFor: {}
      },
      policyErrorMode: 'FAIL_FAST'
    };
  }
}
