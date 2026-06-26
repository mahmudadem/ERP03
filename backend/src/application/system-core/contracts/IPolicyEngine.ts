import { ApprovalSubject } from './IApprovalEngine';

export interface PolicyResolveRequest {
  scope: string;
  action: string;
  companyId?: string;
  context?: Record<string, unknown>;
}

export type PolicyDecision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

/**
 * The decision shape that every policy resolution returns. Older callers
 * (the pre-267 string-scope facade) only read `allowed`/`requiresApproval`/
 * `resolvedBy`; newer callers also consult `decision`, `reasonCode`,
 * `effectiveRuleId`, and `approvalSubject` for audit + handoff to the
 * Approval Engine. The newer fields are added without removing the old ones
 * so legacy callers keep compiling and behaving exactly as before.
 */
export interface PolicyResolveResult {
  allowed: boolean;
  requiresApproval: boolean;
  resolvedBy: string[];
  decision?: PolicyDecision;
  reasonCode?: string;
  effectiveRuleId?: string;
  approvalSubject?: ApprovalSubject;
}

/**
 * Task 267-C — typed request model. The new `IPolicyEngine.resolveTyped(...)`
 * uses these fields to drive the precedence resolver. Modules that want a
 * typed answer call this; the old `resolve({ scope, action, ... })` is
 * preserved for compatibility with the existing facade.
 */
export interface TypedPolicyResolveRequest {
  companyId: string;
  module: string;
  action: string;
  context?: {
    amount?: number;
    currency?: string;
    userId?: string;
    roleId?: string;
    registerId?: string;
    terminalId?: string;
    warehouseId?: string;
    branchId?: string;
    voucherType?: string;
    cashierRoleId?: string;
    approvedOverride?: boolean;
    approvedOverrideId?: string;
    [key: string]: unknown;
  };
}

export interface IPolicyEngine {
  resolve(request: PolicyResolveRequest): Promise<PolicyResolveResult>;
  /**
   * Task 267-C: typed policy resolution. Uses the engine-owned
   * `PolicyConfig` and the precedence engine. Returns a fully populated
   * `PolicyResolveResult` (decision / reasonCode / effectiveRuleId /
   * approvalSubject included). Behaviour-preserving: when the engine has
   * no `IPolicyConfigRepository` wired (or no rules for the request), it
   * returns ALLOW with no effective rule — matching the pre-267 default
   * for unknown scope/action.
   */
  resolveTyped(request: TypedPolicyResolveRequest): Promise<PolicyResolveResult>;
}
