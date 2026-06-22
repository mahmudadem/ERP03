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
    if (request.scope === 'pos' && request.action === 'managerOverride') {
      return this.resolvePosManagerOverride(request);
    }
    if (request.scope === 'pos' && request.action === 'saleLineControls') {
      return this.resolvePosSaleLineControls(request);
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

  // Seam (Task 257): the Policy Engine decides *whether* an override needs approval
  // (CashierRolePolicy.managerOverrideActions). *Who* may approve and the outcome are
  // owned by the Approval Engine (PosManagerOverrideApprovalPlugin), which mints the
  // approvedOverrideId only after a real, authorised, non-self approval. Here we then
  // confirm such a token is present for the actions that require approval.
  private async resolvePosManagerOverride(request: PolicyResolveRequest): Promise<PolicyResolveResult> {
    if (!request.companyId) {
      return { allowed: false, requiresApproval: false, resolvedBy: ['POSPolicy.missingCompany'] };
    }

    const policy = await this.posPolicyRepo.getPolicy(request.companyId);
    const action = String(request.context?.overrideAction || '');
    const cashierRolePolicy = policy?.findCashierRolePolicy(String(request.context?.cashierRoleId || ''));
    const requiresApproval = cashierRolePolicy?.managerOverrideActions.includes(action as any) === true;
    const approvedOverride = request.context?.approvedOverride === true || Boolean(String(request.context?.approvedOverrideId || '').trim());

    const resolvedBy = [
      requiresApproval
        ? `CashierRolePolicy.managerOverride.${action}.requiresApproval`
        : `CashierRolePolicy.managerOverride.${action || 'UNKNOWN'}.notRequired`,
    ];

    if (requiresApproval && !approvedOverride) {
      resolvedBy.push('CashierRolePolicy.managerOverride.blockedPendingApproval');
      return { allowed: false, requiresApproval: true, resolvedBy };
    }

    if (requiresApproval && approvedOverride) {
      resolvedBy.push('ApprovedOverride.allow');
    }

    return { allowed: true, requiresApproval: false, resolvedBy };
  }

  private async resolvePosSaleLineControls(request: PolicyResolveRequest): Promise<PolicyResolveResult> {
    if (!request.companyId) {
      return { allowed: false, requiresApproval: false, resolvedBy: ['POSPolicy.missingCompany'] };
    }

    const policy = await this.posPolicyRepo.getPolicy(request.companyId);
    const cashierRolePolicy = policy?.findCashierRolePolicy(String(request.context?.cashierRoleId || ''));
    if (!cashierRolePolicy) {
      return { allowed: true, requiresApproval: false, resolvedBy: ['CashierRolePolicy.notConfigured'] };
    }

    const approvedOverride =
      request.context?.approvedOverride === true ||
      Boolean(String(request.context?.approvedOverrideId || '').trim());
    const resolvedBy: string[] = [];

    const priceOverride = request.context?.priceOverride === true;
    const taxOverride = request.context?.taxOverride === true;
    const discountPercent = numberOrZero(request.context?.discountPercent);
    const discountAmount = numberOrZero(request.context?.discountAmount);

    if (priceOverride && cashierRolePolicy.allowPriceOverride === false) {
      resolvedBy.push('CashierRolePolicy.priceOverride.blocked');
    }
    if (taxOverride && cashierRolePolicy.allowTaxOverride === false) {
      resolvedBy.push('CashierRolePolicy.taxOverride.blocked');
    }
    if (
      cashierRolePolicy.maxLineDiscountPercent !== undefined &&
      discountPercent > cashierRolePolicy.maxLineDiscountPercent
    ) {
      resolvedBy.push('CashierRolePolicy.maxLineDiscountPercent.exceeded');
    }
    if (
      cashierRolePolicy.maxLineDiscountAmount !== undefined &&
      discountAmount > cashierRolePolicy.maxLineDiscountAmount
    ) {
      resolvedBy.push('CashierRolePolicy.maxLineDiscountAmount.exceeded');
    }

    if (resolvedBy.length === 0) {
      return { allowed: true, requiresApproval: false, resolvedBy: ['CashierRolePolicy.saleLineControls.allow'] };
    }

    if (approvedOverride) {
      return { allowed: true, requiresApproval: false, resolvedBy: [...resolvedBy, 'ApprovedOverride.allow'] };
    }

    return { allowed: false, requiresApproval: true, resolvedBy };
  }
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
