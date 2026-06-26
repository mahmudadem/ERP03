import { AccountingPolicyRegistry } from '../../accounting/policies/AccountingPolicyRegistry';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import {
  IPolicyEngine,
  PolicyResolveRequest,
  PolicyResolveResult,
  TypedPolicyResolveRequest,
} from '../contracts/IPolicyEngine';

export class LegacyPolicyEngineAdapter implements IPolicyEngine {
  constructor(private readonly accountingPolicyRegistry?: AccountingPolicyRegistry) {}

  async resolve(request: PolicyResolveRequest): Promise<PolicyResolveResult> {
    if (request.scope === 'accounting' && request.action === 'postingApprovalRequired' && request.companyId) {
      const voucherType = String(request.context?.voucherType || '');
      const requiresApproval = this.accountingPolicyRegistry
        ? await this.accountingPolicyRegistry.isApprovalRequiredForVoucherType(request.companyId, voucherType)
        : false;
      return { allowed: true, requiresApproval, resolvedBy: ['AccountingPolicyRegistry'] };
    }

    if (request.scope === 'sales' && request.action === 'invoicePersonaAllowed') {
      const settings = request.context?.settings as any;
      const persona = request.context?.persona as any;
      const allowed = settings
        ? DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, persona, request.context as any)
        : false;
      return { allowed, requiresApproval: false, resolvedBy: ['DocumentPolicyResolver.sales'] };
    }

    if (request.scope === 'purchases' && request.action === 'invoicePersonaAllowed') {
      const settings = request.context?.settings as any;
      const persona = request.context?.persona as any;
      const allowed = settings
        ? DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, persona, request.context as any)
        : false;
      return { allowed, requiresApproval: false, resolvedBy: ['DocumentPolicyResolver.purchases'] };
    }

    return { allowed: true, requiresApproval: false, resolvedBy: ['LegacyPolicyEngineAdapter.defaultAllow'] };
  }

  /**
   * Task 267-C: legacy adapter has no `PolicyConfig` store and stays
   * behavior-preserving — it returns the same default-allow fallback that
   * the pre-typed facade returns for unknown scope/action. Modules that
   * need typed resolution must consume the new `PolicyEngine` directly.
   */
  async resolveTyped(_request: TypedPolicyResolveRequest): Promise<PolicyResolveResult> {
    return {
      allowed: true,
      requiresApproval: false,
      decision: 'ALLOW',
      reasonCode: 'LegacyPolicyEngineAdapter.typedNotConfigured',
      resolvedBy: ['LegacyPolicyEngineAdapter.typedNotConfigured'],
    };
  }
}

