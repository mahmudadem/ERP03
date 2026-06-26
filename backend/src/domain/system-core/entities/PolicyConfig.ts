/**
 * PolicyConfig — the neutral, engine-owned typed policy model.
 *
 * Task 267-C: Generic Policy Resolution Engine foundation. This entity replaces
 * the previous "string scope/action" facade with a data-driven precedence model:
 *
 *   hard system rule
 *     → tenant/company default
 *       → module override
 *         → role override
 *           → user override
 *             → register/terminal/warehouse/branch context override
 *               → approved-override escape hatch (for non-hard blocks)
 *
 * One `PolicyConfig` per company, stored in the engine's neutral store. Modules
 * read it through `IPolicyEngine.resolveTyped(...)` and never construct rules
 * locally — that way a POS-only tenant, a Sales-only tenant, or a
 * Purchases-only tenant all consult the same source of truth.
 *
 * This entity is intentionally backward-compatible: `POSPolicy`, `SellingPolicy`,
 * `AccountingPolicyRegistry`, and `DocumentPolicyResolver` keep their own
 * persistence and the `IPolicyEngine.resolve(...)` string-scope facade is
 * unchanged. They are wired in as **compatibility sources** by the engine.
 */

import {
  ApprovalSubject,
  ApprovalSubjectType,
} from '../../../application/system-core/contracts/IApprovalEngine';

export type PolicyEffect = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';

export type PolicyRuleScope =
  | 'TENANT'
  | 'MODULE'
  | 'ROLE'
  | 'USER'
  | 'CONTEXT';

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
  /** Match when the transaction's `amount` passes this comparison. */
  amount?: {
    op: '>' | '>=' | '<' | '<=' | '==' | '!=';
    value: number;
  };
  /** Match by context key/value. Values are compared as strings. */
  match?: Partial<Record<PolicyContextKey, string | string[]>>;
  /** Require an approved override for the rule to apply (positive check). */
  requireApprovedOverride?: boolean;
  /** Other arbitrary condition tags the engine may consult later. */
  [key: string]: unknown;
}

export interface PolicyRule {
  id: string;
  module?: string;
  action: string;
  scope: PolicyRuleScope;
  effect: PolicyEffect;
  reasonCode?: string;
  /** Higher number wins when multiple rules match at the same precedence level. */
  priority?: number;
  conditions?: PolicyRuleConditions;
  /** Optional approval handoff metadata used by `IApprovalEngine`. */
  approvalSubject?: ApprovalSubject;
  /** Threshold shortcut: when set, REQUIRE_APPROVAL is only emitted above this amount. */
  requireApprovalAbove?: number;
  /** When true, the rule cannot be overridden by lower-precedence rules or by an approved override. */
  isHard?: boolean;
}

export interface PolicyConfigProps {
  companyId: string;
  rules: PolicyRule[];
  createdAt?: Date;
  updatedAt?: Date;
}

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

const isApprovalSubjectType = (value: unknown): value is ApprovalSubjectType => {
  return typeof value === 'string' && value.length > 0;
};

const normalizeRule = (rule: PolicyRule): PolicyRule => {
  const id = String(rule.id == null ? '' : rule.id).trim();
  if (!id) {
    // Review feedback (267-C): never silently mint a random id. A rule with no
    // stable id cannot be audited, referenced by `effectiveRuleId`, or diffed
    // across snapshots, so we reject it at the entity boundary instead.
    throw new Error('PolicyRule id is required');
  }
  const action = String(rule.action || '').trim();
  if (!action) {
    throw new Error(`PolicyRule ${id} action is required`);
  }
  if (!rule.scope) {
    throw new Error(`PolicyRule ${id} scope is required`);
  }
  const effect: PolicyEffect = rule.effect;
  const priority = rule.priority === undefined ? 0 : Number(rule.priority);
  return {
    ...rule,
    id,
    action,
    scope: rule.scope,
    effect,
    priority: Number.isFinite(priority) ? priority : 0,
    isHard: rule.isHard === true,
    requireApprovalAbove:
      rule.requireApprovalAbove === undefined || rule.requireApprovalAbove === null
        ? undefined
        : Number(rule.requireApprovalAbove),
    approvalSubject: rule.approvalSubject && isApprovalSubjectType(rule.approvalSubject.type)
      ? {
          type: rule.approvalSubject.type,
          id: String(rule.approvalSubject.id || ''),
          payload: rule.approvalSubject.payload,
        }
      : undefined,
  };
};

export class PolicyConfig {
  readonly companyId: string;
  rules: PolicyRule[];
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PolicyConfigProps) {
    if (!props.companyId?.trim()) throw new Error('PolicyConfig companyId is required');
    this.companyId = props.companyId.trim();
    this.rules = (props.rules || []).map(normalizeRule);
    this.createdAt = toDate(props.createdAt);
    this.updatedAt = toDate(props.updatedAt);
  }

  /**
   * Safe default: an empty rule set. The engine treats "no matching rule" as
   * ALLOW (preserves the pre-267 facade behaviour) until a module explicitly
   * adds rules.
   */
  static createDefault(companyId: string): PolicyConfig {
    return new PolicyConfig({ companyId, rules: [] });
  }

  /**
   * Returns rules for a `(module?, action)` pair, across all scopes, sorted
   * by precedence then by priority (highest priority first, then most
   * restrictive scope first).
   */
  findRules(module: string | undefined, action: string): PolicyRule[] {
    const matches = this.rules.filter((rule) => {
      if (rule.action !== action) return false;
      if (module !== undefined && rule.module !== undefined && rule.module !== module) {
        return false;
      }
      return true;
    });

    const scopeOrder: PolicyRuleScope[] = ['CONTEXT', 'USER', 'ROLE', 'MODULE', 'TENANT'];
    return matches.sort((a, b) => {
      if (a.isHard && !b.isHard) return -1;
      if (!a.isHard && b.isHard) return 1;
      const scopeDiff = scopeOrder.indexOf(a.scope) - scopeOrder.indexOf(b.scope);
      if (scopeDiff !== 0) return scopeDiff;
      return (b.priority || 0) - (a.priority || 0);
    });
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      rules: this.rules.map((rule) => ({ ...rule })),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): PolicyConfig {
    return new PolicyConfig({
      companyId: data.companyId,
      rules: Array.isArray(data.rules) ? data.rules : [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
