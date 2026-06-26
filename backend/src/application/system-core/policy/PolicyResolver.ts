import {
  PolicyConfig,
  PolicyEffect,
  PolicyRule,
  PolicyRuleScope,
} from '../../../domain/system-core/entities/PolicyConfig';
import {
  PolicyDecision,
  PolicyResolveResult,
  TypedPolicyResolveRequest,
} from '../contracts/IPolicyEngine';

/**
 * Task 267-C — the precedence engine.
 *
 * Pure function: given a `PolicyConfig` and a `TypedPolicyResolveRequest`,
 * returns a fully populated `PolicyResolveResult`. No I/O, no side effects.
 *
 * Precedence (highest first):
 *   1. Hard rules (rule.isHard === true) — cannot be overridden.
 *   2. Tenant/company default rules.
 *   3. Module override rules (rule.module === request.module).
 *   4. Role override rules (roleId in conditions).
 *   5. User override rules (userId in conditions).
 *   6. Context override rules (registerId / terminalId / warehouseId / branchId /
 *      voucherType in conditions).
 *
 * At each precedence level the most restrictive effect wins
 * (BLOCK > REQUIRE_APPROVAL > ALLOW). Hard rules at ANY level are absolute:
 * a hard BLOCK on a tenant default still wins over a non-hard module ALLOW.
 *
 * Approved overrides (context.approvedOverride === true OR a non-empty
 * context.approvedOverrideId) clear the most recent non-hard BLOCK /
 * REQUIRE_APPROVAL the resolver was about to return. Hard rules ignore
 * approved overrides — that is the whole point of marking a rule hard.
 */

const PRECEDENCE: PolicyRuleScope[] = ['TENANT', 'MODULE', 'ROLE', 'USER', 'CONTEXT'];

const RESTRICTIVENESS: Record<PolicyEffect, number> = {
  ALLOW: 0,
  REQUIRE_APPROVAL: 1,
  BLOCK: 2,
};

const DEFAULT_ALLOW_RESULT: PolicyResolveResult = Object.freeze({
  allowed: true,
  requiresApproval: false,
  decision: 'ALLOW',
  reasonCode: 'PolicyConfig.noMatchingRule',
  resolvedBy: ['PolicyConfig.noMatchingRule'],
}) as PolicyResolveResult;

const matchesConditions = (rule: PolicyRule, request: TypedPolicyResolveRequest): boolean => {
  const conditions = rule.conditions;
  if (!conditions) return true;

  if (conditions.amount) {
    // Review feedback (267-C): when a rule has an amount condition, the
    // request MUST supply a finite numeric amount. A missing, non-numeric,
    // or NaN amount means the rule cannot be evaluated safely, so it
    // does not match. Same for an invalid (non-finite) condition value
    // or unknown operator.
    if (request.context?.amount === undefined || request.context?.amount === null) {
      return false;
    }
    const amount = Number(request.context.amount);
    if (!Number.isFinite(amount)) return false;
    const target = Number(conditions.amount.value);
    if (!Number.isFinite(target)) return false;
    const op = conditions.amount.op;
    let passes = false;
    switch (op) {
      case '>': passes = amount > target; break;
      case '>=': passes = amount >= target; break;
      case '<': passes = amount < target; break;
      case '<=': passes = amount <= target; break;
      case '==': passes = amount === target; break;
      case '!=': passes = amount !== target; break;
      default: passes = false;
    }
    if (!passes) return false;
  }

  if (conditions.match) {
    const ctx = (request.context || {}) as Record<string, unknown>;
    for (const [key, expected] of Object.entries(conditions.match)) {
      const actual = ctx[key];
      if (actual === undefined || actual === null) return false;
      const actualStr = String(actual);
      const expectedList = Array.isArray(expected) ? expected.map(String) : [String(expected)];
      if (!expectedList.includes(actualStr)) return false;
    }
  }

  if (conditions.requireApprovedOverride === true) {
    const approved =
      ctxFlag(request, 'approvedOverride') === true ||
      String(ctxFlag(request, 'approvedOverrideId') || '').trim().length > 0;
    if (!approved) return false;
  }

  return true;
};

const ctxFlag = (request: TypedPolicyResolveRequest, key: string): unknown => {
  return request.context ? (request.context as Record<string, unknown>)[key] : undefined;
};

const isApprovedOverride = (request: TypedPolicyResolveRequest): boolean => {
  if (ctxFlag(request, 'approvedOverride') === true) return true;
  const id = String(ctxFlag(request, 'approvedOverrideId') || '').trim();
  return id.length > 0;
};

const effectToDecision = (effect: PolicyEffect): PolicyDecision => effect;
/**
 * `allowed` here means "the action may proceed without an approval token."
 * ALLOW → true. REQUIRE_APPROVAL → false (action is blocked pending an
 * approved override). BLOCK → false. This matches the pre-267 facade
 * contract used by `IPolicyEngine.resolve({ scope, action, ... })` and
 * by the existing POS / Sales / Purchases use-cases.
 */
const effectToAllowed = (effect: PolicyEffect): boolean => effect === 'ALLOW';
const effectToRequiresApproval = (effect: PolicyEffect): boolean => effect === 'REQUIRE_APPROVAL';

const labelFor = (rule: PolicyRule, level: PolicyRuleScope): string => {
  return `PolicyConfig.${level}.${rule.id}.${rule.effect}`;
};

export interface PolicyResolutionTrace {
  rule: PolicyRule;
  level: PolicyRuleScope;
  matched: boolean;
  effect?: PolicyEffect;
}

export interface PolicyResolverResult {
  result: PolicyResolveResult;
  trace: PolicyResolutionTrace[];
}

export class PolicyResolver {
  /**
   * Resolves a `TypedPolicyResolveRequest` against the supplied
   * `PolicyConfig`. Returns a `PolicyResolveResult` and a `trace` describing
   * every rule that was considered (matched or not), in precedence order.
   * The trace is intended for audit / tests; callers normally only need
   * the `result`.
   */
  static resolve(
    config: PolicyConfig | null,
    request: TypedPolicyResolveRequest
  ): PolicyResolverResult {
    const trace: PolicyResolutionTrace[] = [];
    if (!config) {
      return {
        result: {
          allowed: true,
          requiresApproval: false,
          decision: 'ALLOW',
          reasonCode: 'PolicyConfig.absent',
          resolvedBy: ['PolicyConfig.absent'],
        },
        trace,
      };
    }

    const candidates = config.findRules(request.module, request.action);
    if (candidates.length === 0) {
      return { result: { ...DEFAULT_ALLOW_RESULT }, trace };
    }

    // Bucket candidates by precedence level so we can walk the chain in order
    // and remember the most restrictive non-hard effect for the approved-
    // override escape hatch.
    const buckets: Record<PolicyRuleScope, PolicyRule[]> = {
      TENANT: [],
      MODULE: [],
      ROLE: [],
      USER: [],
      CONTEXT: [],
    };
    for (const rule of candidates) {
      const matched = matchesConditions(rule, request);
      trace.push({ rule, level: rule.scope, matched });
      if (matched) buckets[rule.scope].push(rule);
    }

    // Hard rules anywhere win absolutely.
    for (const level of PRECEDENCE) {
      for (const rule of buckets[level]) {
        if (rule.isHard === true) {
          const result: PolicyResolveResult = {
            allowed: effectToAllowed(rule.effect),
            requiresApproval: effectToRequiresApproval(rule.effect),
            decision: effectToDecision(rule.effect),
            reasonCode: rule.reasonCode || `PolicyConfig.${level}.hardRule`,
            resolvedBy: [
              `PolicyConfig.${level}.${rule.id}.hard`,
              ...(rule.effect === 'BLOCK' ? ['PolicyConfig.hardRule.absolute'] : []),
            ],
            effectiveRuleId: rule.id,
            approvalSubject: rule.approvalSubject,
          };
          return { result, trace };
        }
      }
    }

    // Walk the chain in precedence order. More specific levels override
    // less specific ones (CONTEXT > USER > ROLE > MODULE > TENANT) only
    // when they explicitly match. Otherwise we keep the previous level's
    // decision.
    let chosen: { rule: PolicyRule; level: PolicyRuleScope } | null = null;
    for (const level of PRECEDENCE) {
      const matched = buckets[level];
      if (matched.length === 0) continue;

      // At the same level, most restrictive effect wins, ties broken by priority desc.
      const winner = matched.reduce((acc, cur) => {
        if (!acc) return cur;
        const a = RESTRICTIVENESS[acc.effect];
        const c = RESTRICTIVENESS[cur.effect];
        if (c > a) return cur;
        if (c < a) return acc;
        return (cur.priority || 0) > (acc.priority || 0) ? cur : acc;
      }, matched[0]);

      if (!chosen) {
        chosen = { rule: winner, level };
        continue;
      }

      // A matched level overrides the previous level's choice (more specific wins).
      chosen = { rule: winner, level };
    }

    if (!chosen) {
      return { result: { ...DEFAULT_ALLOW_RESULT }, trace };
    }

    const { rule, level } = chosen;
    let effect: PolicyEffect = rule.effect;

    // Threshold shortcut: REQUIRE_APPROVAL is only emitted above the configured amount.
    if (effect === 'REQUIRE_APPROVAL' && rule.requireApprovalAbove !== undefined) {
      const amount = Number(request.context?.amount);
      if (!Number.isFinite(amount) || amount <= Number(rule.requireApprovalAbove)) {
        // Below threshold → treat as ALLOW.
        effect = 'ALLOW';
      }
    }

    // Approved override clears non-hard BLOCK / REQUIRE_APPROVAL.
    const approvedOverride = isApprovedOverride(request);
    if (approvedOverride && (effect === 'BLOCK' || effect === 'REQUIRE_APPROVAL')) {
      trace.push({ rule, level, matched: true, effect: 'ALLOW' });
      return {
        result: {
          allowed: true,
          requiresApproval: false,
          decision: 'ALLOW',
          reasonCode: rule.reasonCode || 'PolicyConfig.approvedOverride',
          resolvedBy: [labelFor(rule, level), 'PolicyConfig.approvedOverride'],
          effectiveRuleId: rule.id,
          approvalSubject: rule.approvalSubject,
        },
        trace,
      };
    }

    return {
      result: {
        allowed: effectToAllowed(effect),
        requiresApproval: effectToRequiresApproval(effect),
        decision: effectToDecision(effect),
        reasonCode: rule.reasonCode || `PolicyConfig.${level}.${rule.effect}`,
        resolvedBy: [labelFor(rule, level)],
        effectiveRuleId: rule.id,
        approvalSubject: effect === 'REQUIRE_APPROVAL' ? rule.approvalSubject : undefined,
      },
      trace,
    };
  }
}
