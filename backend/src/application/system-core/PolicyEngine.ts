import { AccountingPolicyRegistry } from '../accounting/policies/AccountingPolicyRegistry';
import { IPosPolicyRepository } from '../../repository/interfaces/pos/IPosPolicyRepository';
import { DocumentPolicyResolver } from '../common/services/DocumentPolicyResolver';
import { IPolicyEngine, PolicyResolveRequest, PolicyResolveResult } from './contracts/IPolicyEngine';

export class PolicyEngine implements IPolicyEngine {
  constructor(
    private readonly posPolicyRepo: IPosPolicyRepository,
    private readonly accountingPolicyRegistry?: AccountingPolicyRegistry
  ) {}

  async resolve(request: PolicyResolveRequest): Promise<PolicyResolveResult> {
    if (request.scope === 'pos' && request.action === 'directSale') {
      return this.resolvePosDirectSale(request);
    }

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

    return { allowed: true, requiresApproval: false, resolvedBy: ['PolicyEngine.defaultAllow'] };
  }

  private async resolvePosDirectSale(request: PolicyResolveRequest): Promise<PolicyResolveResult> {
    if (!request.companyId) {
      return { allowed: false, requiresApproval: false, resolvedBy: ['POSPolicy.missingCompany'] };
    }

    const policy = await this.posPolicyRepo.getPolicy(request.companyId);
    const resolvedBy: string[] = [];
    let allowed = policy?.allowPosDirectSales === true;
    resolvedBy.push(allowed ? 'POSPolicy.allowPosDirectSales.allow' : 'POSPolicy.allowPosDirectSales.deny');

    const terminalPolicy = policy?.findTerminalPolicy(String(request.context?.registerId || ''));
    if (terminalPolicy?.allowDirectSales === false) {
      allowed = false;
      resolvedBy.push('POSTerminalPolicy.allowDirectSales.deny');
    } else if (terminalPolicy?.allowDirectSales === true) {
      resolvedBy.push('POSTerminalPolicy.allowDirectSales.allowIgnoredByMostRestrictiveWins');
    }

    const cashierRolePolicy = policy?.findCashierRolePolicy(String(request.context?.cashierRoleId || ''));
    const requiresApproval = cashierRolePolicy?.requireApprovalForDirectSales === true;
    if (requiresApproval) {
      resolvedBy.push('CashierRolePolicy.directSale.requiresApproval');
    }

    const approvedOverride = request.context?.approvedOverride === true;
    if (!allowed && approvedOverride) {
      allowed = true;
      resolvedBy.push('ApprovedOverride.allow');
    }

    if (requiresApproval && !approvedOverride) {
      allowed = false;
      resolvedBy.push('CashierRolePolicy.directSale.blockedPendingApproval');
    }

    return { allowed, requiresApproval: requiresApproval && !approvedOverride, resolvedBy };
  }
}
