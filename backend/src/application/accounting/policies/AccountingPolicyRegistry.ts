import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import { AccountingPolicyConfig } from '../../../domain/accounting/policies/PostingPolicyTypes';
import { IPostingPolicy } from '../../../domain/accounting/policies/IPostingPolicy';
import { ApprovalRequiredPolicy } from '../../../domain/accounting/policies/implementations/ApprovalRequiredPolicy';
import { PeriodLockPolicy } from '../../../domain/accounting/policies/implementations/PeriodLockPolicy';
import { AccountAccessPolicy } from '../../../domain/accounting/policies/implementations/AccountAccessPolicy';
import { IUserAccessScopeProvider } from '../../../infrastructure/accounting/access/IUserAccessScopeProvider';
import { IAccountLookupService } from '../../../domain/accounting/services/IAccountLookupService';

/**
 * AccountingPolicyRegistry
 * 
 * Application-layer component that wires enabled policies based on configuration.
 * 
 * Responsibilities:
 * - Load policy config for a company
 * - Instantiate enabled policy implementations
 * - Return ordered list of policies to enforce
 * 
 * This is pure composition/wiring - NO business logic here.
 * Business logic belongs in individual policy implementations.
 */
export class AccountingPolicyRegistry {
  constructor(
    private readonly configProvider: IAccountingPolicyConfigProvider,
    private readonly userScopeProvider?: IUserAccessScopeProvider,
    private readonly accountLookup?: IAccountLookupService
  ) {}

  /**
   * Get enabled policies for a company
   * 
   * Returns policies in order of execution.
   * Policies are instantiated fresh each time to avoid stale config.
   * 
   * @param companyId - Company identifier
   * @returns Array of enabled policy instances
   */
  async getEnabledPolicies(companyId: string): Promise<IPostingPolicy[]> {
    const config = await this.configProvider.getConfig(companyId);
    const policies: IPostingPolicy[] = [];

    // Wire policies based on config
    if (config.approvalRequired) {
      policies.push(new ApprovalRequiredPolicy());
    }

    if (config.periodLockEnabled) {
      policies.push(new PeriodLockPolicy(config.lockedThroughDate));
    }

    if (config.accountAccessEnabled && this.userScopeProvider && this.accountLookup) {
      policies.push(new AccountAccessPolicy(this.userScopeProvider, this.accountLookup));
    }

    if (config.costCenterPolicy?.enabled && this.accountLookup) {
      const { CostCenterRequiredPolicy } = await import('../../../domain/accounting/policies/implementations/CostCenterRequiredPolicy');
      policies.push(new CostCenterRequiredPolicy(
        config.costCenterPolicy.requiredFor,
        this.accountLookup
      ));
    }

    return policies;
  }

  /**
   * Get raw config for a company (useful for debugging/reporting)
   */
  async getConfig(companyId: string): Promise<AccountingPolicyConfig> {
    return this.configProvider.getConfig(companyId);
  }
}
