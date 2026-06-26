/**
 * controlsPoliciesApi.ts — Neutral frontend client for the engine-owned
 * typed `PolicyConfig` company-wide matrix doorway.
 *
 * Task 267-E (Engine Management Frontend): this module is intentionally
 * NEUTRAL — it is not owned by any single module. It talks to the
 * company-wide doorway `/tenant/settings/controls/policies` so the
 * Controls & Policies screen can read/write the full rule matrix.
 *
 * Per-module doorways (POS / Sales / Purchases) live in their own
 * `posApi.ts` / `salesApi.ts` / `purchasesApi.ts` so a module-only
 * tenant can edit only its own rules.
 *
 * Tenant isolation: no companyId is ever placed in the request body.
 * The shared axios client attaches `x-company-id` from the active
 * company context interceptor. Forging a companyId from the UI is
 * therefore impossible — the backend ignores any body-level
 * companyId and resolves the caller's tenant context server-side
 * (see `PolicyConfigController.getCompanyId`).
 */
import client from './client';

export type PolicyEffect = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

export type PolicyRuleScope = 'TENANT' | 'MODULE' | 'ROLE' | 'USER' | 'CONTEXT';

export type PolicyAmountOp = '>' | '>=' | '<' | '<=' | '==' | '!=';

export type PolicyContextKey =
  | 'registerId'
  | 'terminalId'
  | 'warehouseId'
  | 'branchId'
  | 'roleId'
  | 'userId'
  | 'voucherType'
  | 'currency'
  | 'cashierRoleId';

export interface PolicyRuleConditions {
  amount?: { op: PolicyAmountOp; value: number };
  match?: Partial<Record<PolicyContextKey, string | string[]>>;
  requireApprovedOverride?: boolean;
  [key: string]: unknown;
}

export interface PolicyApprovalSubject {
  type: string;
  id?: string;
  payload?: unknown;
}

export interface PolicyRule {
  id: string;
  module?: string;
  action: string;
  scope: PolicyRuleScope;
  effect: PolicyEffect;
  reasonCode?: string;
  priority?: number;
  conditions?: PolicyRuleConditions;
  approvalSubject?: PolicyApprovalSubject;
  requireApprovalAbove?: number;
  isHard?: boolean;
}

export interface PolicyConfigDTO {
  companyId: string;
  rules: PolicyRule[];
  createdAt?: string;
  updatedAt?: string;
}

const unwrap = <T>(p: Promise<any>): Promise<T> =>
  p.then((r: any) => (r?.data?.data ?? r?.data ?? r) as T);

export const controlsPoliciesApi = {
  /** GET /tenant/settings/controls/policies — the full company-wide matrix. */
  getControlsPolicies: async (): Promise<PolicyConfigDTO> =>
    unwrap(client.get('/tenant/settings/controls/policies')),

  /** PUT /tenant/settings/controls/policies — replace the full matrix. */
  updateControlsPolicies: async (payload: { rules: PolicyRule[] }): Promise<PolicyConfigDTO> =>
    unwrap(client.put('/tenant/settings/controls/policies', payload)),
};