import { AccountingPolicyRegistry } from '../accounting/policies/AccountingPolicyRegistry';
import { IPosPolicyRepository } from '../../repository/interfaces/pos/IPosPolicyRepository';
import { IPolicyConfigRepository } from '../../repository/interfaces/system-core/IPolicyConfigRepository';
import { DocumentPolicyResolver } from '../common/services/DocumentPolicyResolver';
import {
  IPolicyEngine,
  PolicyResolveRequest,
  PolicyResolveResult,
  TypedPolicyResolveRequest,
} from './contracts/IPolicyEngine';
import { ICommercialCore } from './contracts/ICommercialCore';
import { PolicyConfig } from '../../domain/system-core/entities/PolicyConfig';
import { PolicyResolver } from './policy/PolicyResolver';

export class PolicyEngine implements IPolicyEngine {
  constructor(
    private readonly posPolicyRepo: IPosPolicyRepository,
    private readonly accountingPolicyRegistry?: AccountingPolicyRegistry,
    private readonly commercialCore?: ICommercialCore,
    /**
     * Task 267-C: optional engine-owned `PolicyConfig` repository. When wired,
     * `resolveTyped` consults the typed precedence model. When omitted the
     * legacy `resolve` facade still works exactly as before.
     */
    private readonly policyConfigRepo?: IPolicyConfigRepository
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

    // Shared commercial selling policy (below-cost / minimum-margin), consumed by
    // both POS and Sales. The Commercial Core does the margin math and resolves
    // the company-wide SellingPolicy (BLOCK / REQUIRE_APPROVAL / ALLOW); this
    // branch is the cross-module façade so any module can ask the same question.
    if (request.scope === 'commercial' && request.action === 'belowCostSale') {
      return this.resolveCommercialBelowCost(request);
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

  /**
   * Task 267-C — typed policy resolution. Loads the engine-owned
   * `PolicyConfig` (if a repository is wired) and asks the precedence
   * engine for a fully populated decision.
   *
   * Fail-closed semantics (review feedback 267-C):
   *   - When no repository is wired, returns the pre-267 default ALLOW
   *     (preserves the unknown-scope fallback so legacy callers and
   *     tests that don't wire a repository keep behaving exactly as
   *     before).
   *   - When a repository IS wired and `getConfig` throws, we MUST NOT
   *     silently fall through to default-allow — that would let a
   *     transient store failure (Firestore / SQL down, timeout, etc.)
   *     grant permissions the tenant never configured. Instead we
   *     return an explicit `BLOCK` with
   *     `reasonCode: 'PolicyConfig.repositoryError'` so callers /
   *     approval handoffs can detect the degraded mode and surface it
   *     in the audit chain. We catch the error here so the engine does
   *     not throw into the request thread — a graceful BLOCK is the
   *     safer failure mode than an unhandled rejection in a posting
   *     path.
   */
  async resolveTyped(request: TypedPolicyResolveRequest): Promise<PolicyResolveResult> {
    if (!request.companyId) {
      return {
        allowed: false,
        requiresApproval: false,
        decision: 'BLOCK',
        reasonCode: 'PolicyConfig.missingCompanyId',
        resolvedBy: ['PolicyConfig.missingCompanyId'],
      };
    }

    if (this.policyConfigRepo) {
      // Wired repository: surface the result cleanly. A throwing
      // repository is degraded mode and MUST NOT default-allow.
      let config: PolicyConfig | null;
      try {
        config = await this.policyConfigRepo.getConfig(request.companyId);
      } catch (err) {
        return {
          allowed: false,
          requiresApproval: false,
          decision: 'BLOCK',
          reasonCode: 'PolicyConfig.repositoryError',
          resolvedBy: [
            'PolicyConfig.repositoryError',
            `PolicyConfig.repositoryError.cause=${(err as Error)?.message || 'unknown'}`,
          ],
        };
      }
      if (!config) {
        // Repository is wired but has no document yet for this company.
        // No rules means default ALLOW (consistent with the unknown-scope
        // fallback that the legacy facade uses for any action it does not
        // recognise).
        return PolicyResolver.resolve(
          PolicyConfig.createDefault(request.companyId),
          request
        ).result;
      }
      return PolicyResolver.resolve(config, request).result;
    }

    // No repository wired. Fall back to the pre-267 default-allow so
    // call sites that haven't opted into the typed path keep working.
    return PolicyResolver.resolve(
      PolicyConfig.createDefault(request.companyId),
      request
    ).result;
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

  private async resolveCommercialBelowCost(request: PolicyResolveRequest): Promise<PolicyResolveResult> {
    if (!this.commercialCore) {
      return { allowed: true, requiresApproval: false, resolvedBy: ['CommercialCore.notConfigured'] };
    }
    const ctx = request.context || {};
    const result = await this.commercialCore.validateCostMargin({
      companyId: request.companyId || '',
      itemId: String(ctx.itemId || ''),
      unitPriceBase: Number(ctx.unitPriceBase) || 0,
      unitCostBase: ctx.unitCostBase !== undefined ? Number(ctx.unitCostBase) : undefined,
      quantity: ctx.quantity !== undefined ? Number(ctx.quantity) : undefined,
      minimumMarginPct: ctx.minimumMarginPct !== undefined ? Number(ctx.minimumMarginPct) : undefined,
      actorUserId: ctx.actorUserId as string | undefined,
      approvedOverride: ctx.approvedOverride === true,
      source: (ctx.source as string) || 'commercial',
    });
    return {
      allowed: result.allowed,
      requiresApproval: result.requiresApproval,
      resolvedBy: [`CommercialCore.belowCost.${result.reason}`],
    };
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
