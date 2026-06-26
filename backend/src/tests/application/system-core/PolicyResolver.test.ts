import {
  PolicyConfig,
  PolicyRule,
} from '../../../domain/system-core/entities/PolicyConfig';
import { PolicyResolver } from '../../../application/system-core/policy/PolicyResolver';

/**
 * Task 267-C — the precedence engine that turns a company `PolicyConfig` and
 * a `TypedPolicyResolveRequest` into a fully populated `PolicyResolveResult`.
 * These tests pin the precedence contract and audit metadata that the new
 * `IPolicyEngine.resolveTyped(...)` exposes. They are pure-function tests, so
 * they exercise `PolicyResolver` directly (no engine wiring) for clarity.
 */
describe('PolicyResolver (Task 267-C)', () => {
  const COMPANY = 'cmp_1';

  it('returns ALLOW with noMatchingRule when the config has no matching rules', () => {
    const config = PolicyConfig.createDefault(COMPANY);
    const { result } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
    });

    expect(result).toMatchObject({
      allowed: true,
      requiresApproval: false,
      decision: 'ALLOW',
      reasonCode: 'PolicyConfig.noMatchingRule',
    });
    expect(result.resolvedBy).toContain('PolicyConfig.noMatchingRule');
  });

  it('tenant default blocks an action', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'tenant-block-all',
          scope: 'TENANT',
          action: 'invoicePosting',
          effect: 'BLOCK',
          reasonCode: 'TENANT_BLOCKED',
        },
      ],
    });
    const { result } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'sales',
      action: 'invoicePosting',
    });
    expect(result).toMatchObject({
      allowed: false,
      requiresApproval: false,
      decision: 'BLOCK',
      reasonCode: 'TENANT_BLOCKED',
    });
    expect(result.effectiveRuleId).toBe('tenant-block-all');
  });

  it('module override requires approval and survives in resolvedBy', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'module-sales-invoice',
          scope: 'MODULE',
          module: 'sales',
          action: 'invoicePosting',
          effect: 'REQUIRE_APPROVAL',
          reasonCode: 'SALES_INVOICE_OVER_THRESHOLD',
        },
      ],
    });
    const { result } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'sales',
      action: 'invoicePosting',
    });
    expect(result).toMatchObject({
      allowed: false,
      requiresApproval: true,
      decision: 'REQUIRE_APPROVAL',
      reasonCode: 'SALES_INVOICE_OVER_THRESHOLD',
    });
    expect(result.effectiveRuleId).toBe('module-sales-invoice');
    expect(result.resolvedBy[0]).toMatch(/PolicyConfig\.MODULE\.module-sales-invoice\.REQUIRE_APPROVAL/);
  });

  it('hard rule blocks even when a module override allows', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'module-pos-allow',
          scope: 'MODULE',
          module: 'pos',
          action: 'directSale',
          effect: 'ALLOW',
        },
        {
          id: 'tenant-hard-block',
          scope: 'TENANT',
          action: 'directSale',
          effect: 'BLOCK',
          isHard: true,
          reasonCode: 'PERIOD_LOCK_HARD',
        },
      ],
    });
    const { result } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
    });
    expect(result).toMatchObject({
      allowed: false,
      requiresApproval: false,
      decision: 'BLOCK',
      reasonCode: 'PERIOD_LOCK_HARD',
    });
    expect(result.effectiveRuleId).toBe('tenant-hard-block');
    expect(result.resolvedBy).toContain('PolicyConfig.TENANT.tenant-hard-block.hard');
    expect(result.resolvedBy).toContain('PolicyConfig.hardRule.absolute');
  });

  it('POS terminal direct sale resolves to ALLOW when module override allows and no hard rule blocks', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'pos-direct-sale-allow',
          scope: 'MODULE',
          module: 'pos',
          action: 'directSale',
          effect: 'ALLOW',
          reasonCode: 'POS_DIRECT_SALE_ALLOWED',
        },
      ],
    });
    const { result } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
      context: { registerId: 'reg-1' },
    });
    expect(result).toMatchObject({
      allowed: true,
      requiresApproval: false,
      decision: 'ALLOW',
      reasonCode: 'POS_DIRECT_SALE_ALLOWED',
    });
    expect(result.effectiveRuleId).toBe('pos-direct-sale-allow');
  });

  it('Sales invoice posting requires approval when the transaction amount is over the threshold', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'sales-invoice-threshold',
          scope: 'MODULE',
          module: 'sales',
          action: 'invoicePosting',
          effect: 'REQUIRE_APPROVAL',
          requireApprovalAbove: 10000,
          reasonCode: 'SALES_INVOICE_OVER_THRESHOLD',
        },
      ],
    });
    const below = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'sales',
      action: 'invoicePosting',
      context: { amount: 5000 },
    });
    expect(below.result).toMatchObject({
      allowed: true,
      requiresApproval: false,
      decision: 'ALLOW',
    });

    const over = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'sales',
      action: 'invoicePosting',
      context: { amount: 25000 },
    });
    expect(over.result).toMatchObject({
      allowed: false,
      requiresApproval: true,
      decision: 'REQUIRE_APPROVAL',
      reasonCode: 'SALES_INVOICE_OVER_THRESHOLD',
    });
    expect(over.result.effectiveRuleId).toBe('sales-invoice-threshold');
  });

  it('Purchase invoice posting requires approval when the transaction amount is over the threshold', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'purchase-invoice-threshold',
          scope: 'MODULE',
          module: 'purchases',
          action: 'invoicePosting',
          effect: 'REQUIRE_APPROVAL',
          requireApprovalAbove: 5000,
          reasonCode: 'PURCHASE_INVOICE_OVER_THRESHOLD',
        },
      ],
    });
    const over = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'purchases',
      action: 'invoicePosting',
      context: { amount: 7500 },
    });
    expect(over.result).toMatchObject({
      allowed: false,
      requiresApproval: true,
      decision: 'REQUIRE_APPROVAL',
      reasonCode: 'PURCHASE_INVOICE_OVER_THRESHOLD',
    });
    expect(over.result.effectiveRuleId).toBe('purchase-invoice-threshold');
  });

  it('result includes decision, reasonCode, resolvedBy, and effective rule metadata', () => {
    const rule: PolicyRule = {
      id: 'tenant-default-block',
      scope: 'TENANT',
      action: 'periodClose',
      effect: 'BLOCK',
      reasonCode: 'PERIOD_LOCKED',
    };
    const config = new PolicyConfig({ companyId: COMPANY, rules: [rule] });
    const { result, trace } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'accounting',
      action: 'periodClose',
    });
    expect(result.decision).toBe('BLOCK');
    expect(result.reasonCode).toBe('PERIOD_LOCKED');
    expect(result.effectiveRuleId).toBe('tenant-default-block');
    expect(result.resolvedBy).toEqual([
      'PolicyConfig.TENANT.tenant-default-block.BLOCK',
    ]);
    expect(trace.length).toBe(1);
    expect(trace[0].rule.id).toBe(rule.id);
    expect(trace[0].rule.effect).toBe(rule.effect);
    expect(trace[0].rule.scope).toBe(rule.scope);
    expect(trace[0].matched).toBe(true);
  });

  it('role override wins over module override for matching role', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'module-block',
          scope: 'MODULE',
          module: 'pos',
          action: 'priceOverride',
          effect: 'BLOCK',
        },
        {
          id: 'role-cashier-jr-allow',
          scope: 'ROLE',
          module: 'pos',
          action: 'priceOverride',
          effect: 'ALLOW',
          conditions: { match: { roleId: 'cashier-jr' } },
        },
      ],
    });
    const { result } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'pos',
      action: 'priceOverride',
      context: { roleId: 'cashier-jr' },
    });
    expect(result.allowed).toBe(true);
    expect(result.effectiveRuleId).toBe('role-cashier-jr-allow');
  });

  it('register context override can exempt a specific terminal from a tenant BLOCK', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'tenant-block-sale',
          scope: 'TENANT',
          action: 'directSale',
          effect: 'BLOCK',
        },
        {
          id: 'context-reg-ok-allow',
          scope: 'CONTEXT',
          module: 'pos',
          action: 'directSale',
          effect: 'ALLOW',
          conditions: { match: { registerId: 'reg-ok' } },
        },
      ],
    });
    const otherTerminal = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
      context: { registerId: 'reg-other' },
    });
    expect(otherTerminal.result.allowed).toBe(false);

    const exemptTerminal = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
      context: { registerId: 'reg-ok' },
    });
    expect(exemptTerminal.result.allowed).toBe(true);
    expect(exemptTerminal.result.effectiveRuleId).toBe('context-reg-ok-allow');
  });

  it('approved override clears a non-hard BLOCK but cannot override a hard BLOCK', () => {
    const hardConfig = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'hard-block',
          scope: 'TENANT',
          action: 'directSale',
          effect: 'BLOCK',
          isHard: true,
        },
      ],
    });
    const hardWithApproval = PolicyResolver.resolve(hardConfig, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
      context: { approvedOverride: true },
    });
    expect(hardWithApproval.result.allowed).toBe(false);
    expect(hardWithApproval.result.effectiveRuleId).toBe('hard-block');

    const nonHardConfig = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'soft-block',
          scope: 'MODULE',
          module: 'pos',
          action: 'directSale',
          effect: 'BLOCK',
        },
      ],
    });
    const softWithApproval = PolicyResolver.resolve(nonHardConfig, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
      context: { approvedOverrideId: 'mgr_123' },
    });
    expect(softWithApproval.result.allowed).toBe(true);
    expect(softWithApproval.result.decision).toBe('ALLOW');
    expect(softWithApproval.result.resolvedBy).toContain('PolicyConfig.approvedOverride');
  });

  it('user override wins over role override when both match', () => {
    const config = new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'role-block',
          scope: 'ROLE',
          module: 'pos',
          action: 'priceOverride',
          effect: 'BLOCK',
          conditions: { match: { roleId: 'cashier-jr' } },
        },
        {
          id: 'user-allow',
          scope: 'USER',
          module: 'pos',
          action: 'priceOverride',
          effect: 'ALLOW',
          conditions: { match: { userId: 'u_special' } },
        },
      ],
    });
    const { result } = PolicyResolver.resolve(config, {
      companyId: COMPANY,
      module: 'pos',
      action: 'priceOverride',
      context: { roleId: 'cashier-jr', userId: 'u_special' },
    });
    expect(result.allowed).toBe(true);
    expect(result.effectiveRuleId).toBe('user-allow');
  });

  it('null config returns ALLOW with a PolicyConfig.absent reasonCode', () => {
    const { result } = PolicyResolver.resolve(null, {
      companyId: COMPANY,
      module: 'pos',
      action: 'directSale',
    });
    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBe('PolicyConfig.absent');
  });

  // Review feedback (267-C): when a rule has an `amount` condition, the
  // request MUST supply a finite numeric amount. Missing / non-numeric /
  // NaN amounts must NOT match. Same for an invalid (non-finite) condition
  // value or unknown operator.
  describe('amount condition (review feedback 267-C)', () => {
    const ruleWithAmount = (op: any, value: any): PolicyConfig => new PolicyConfig({
      companyId: COMPANY,
      rules: [
        {
          id: 'amount-rule',
          scope: 'MODULE',
          module: 'sales',
          action: 'invoicePosting',
          effect: 'BLOCK',
          conditions: { amount: { op, value } },
        },
      ],
    });

    it('does NOT match when context.amount is missing', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('>', 0), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: {},
      });
      expect(result.allowed).toBe(true);
      expect(result.reasonCode).toBe('PolicyConfig.noMatchingRule');
    });

    it('does NOT match when context.amount is null', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('>', 0), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: { amount: null },
      });
      expect(result.allowed).toBe(true);
    });

    it('does NOT match when context.amount is non-numeric', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('>', 0), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: { amount: 'not-a-number' as any },
      });
      expect(result.allowed).toBe(true);
    });

    it('does NOT match when context.amount is NaN', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('>', 0), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: { amount: Number.NaN },
      });
      expect(result.allowed).toBe(true);
    });

    it('does NOT match when the condition value is invalid (NaN / Infinity)', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('>', Number.NaN), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: { amount: 100 },
      });
      expect(result.allowed).toBe(true);
    });

    it('does NOT match when the condition op is unknown', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('===' as any, 0), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: { amount: 0 },
      });
      expect(result.allowed).toBe(true);
    });

    it('still matches when context.amount is a valid finite number and the comparison passes', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('>', 0), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: { amount: 100 },
      });
      expect(result.allowed).toBe(false);
      expect(result.effectiveRuleId).toBe('amount-rule');
    });

    it('does NOT match when context.amount is finite but the comparison fails', () => {
      const { result } = PolicyResolver.resolve(ruleWithAmount('>', 1000), {
        companyId: COMPANY,
        module: 'sales',
        action: 'invoicePosting',
        context: { amount: 100 },
      });
      expect(result.allowed).toBe(true);
    });
  });
});
