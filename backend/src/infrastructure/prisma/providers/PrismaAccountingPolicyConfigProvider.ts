/**
 * PrismaAccountingPolicyConfigProvider
 * 
 * Prisma-based implementation of IAccountingPolicyConfigProvider.
 * Reads accounting policy configuration from SQL database via Prisma.
 * 
 * Storage location: company_module_settings table (moduleId = 'accounting')
 * 
 * Returns sensible defaults if config doesn't exist,
 * ensuring the system works even for new companies.
 */
import { PrismaClient } from '@prisma/client';
import { IAccountingPolicyConfigProvider } from '../../accounting/config/IAccountingPolicyConfigProvider';
import { AccountingPolicyConfig } from '../../../domain/accounting/policies/PostingPolicyTypes';

export class PrismaAccountingPolicyConfigProvider implements IAccountingPolicyConfigProvider {
  constructor(private prisma: PrismaClient) {}

  async getConfig(companyId: string): Promise<AccountingPolicyConfig> {
    try {
      const settings = await this.prisma.companyModuleSettings.findUnique({
        where: { companyId_moduleId: { companyId, moduleId: 'accounting' } },
      });

      console.log('[PolicyConfigProvider] Document exists:', !!settings);

      if (!settings) {
        console.log('[PolicyConfigProvider] Returning default config (document not found)');
        return this.getDefaultConfig();
      }

      const data = settings.settings as any;
      console.log('[PolicyConfigProvider] Raw data:', JSON.stringify(data, null, 2));
      
      if (!data) {
        return this.getDefaultConfig();
      }

      // Merge with defaults to handle missing fields and ensure structural integrity
      const merged = {
        ...this.getDefaultConfig(),
        ...data,
        // Override nested objects specifically if they exist to avoid partial merges
        costCenterPolicy: {
          ...(this.getDefaultConfig().costCenterPolicy),
          ...(data.costCenterPolicy || {})
        }
      };

      // Backward compat: map legacy key to canonical key when canonical is absent.
      if (merged.allowEditPostedVouchersEnabled !== undefined && merged.allowEditDeletePosted === undefined) {
        merged.allowEditDeletePosted = merged.allowEditPostedVouchersEnabled;
      }

      // CRITICAL: approval is required when either financial approval or custody confirmation is enabled.
      merged.approvalRequired = !!(merged.financialApprovalEnabled || merged.custodyConfirmationEnabled);
      
      console.log('[PolicyConfigProvider] Merged config:', JSON.stringify(merged, null, 2));
      return merged;
    } catch (error) {
      console.error(`Failed to load policy config for company ${companyId}:`, error);
      // Fail safe: return default config
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): AccountingPolicyConfig {
    return {
      // Approval Policy V1 - all gates OFF by default (Mode A: Auto-Post)
      financialApprovalEnabled: false,
      faApplyMode: 'ALL',  // Default: apply to all vouchers when FA is ON
      custodyConfirmationEnabled: false,
      // Derived: true if ANY gate (financial approval or custody confirmation) is enabled.
      approvalRequired: false,  // Both gates default to false
      
      // Mode A Controls (V1)
      autoPostEnabled: true,                    // Default: auto-post when approved

      
      // Period Lock
      periodLockEnabled: false,
      lockedThroughDate: undefined,
      
      accountAccessEnabled: false,
      costCenterPolicy: {
        enabled: false,
        requiredFor: {}
      },
      policyErrorMode: 'FAIL_FAST',
      paymentMethods: [
        { id: 'bank_transfer', name: 'Bank Transfer', isEnabled: true },
        { id: 'cash', name: 'Cash', isEnabled: true },
        { id: 'check', name: 'Check', isEnabled: true }
      ]
    };
  }
}
