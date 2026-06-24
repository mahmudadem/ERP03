import { PolicyEngine } from '../../../application/system-core/PolicyEngine';
import { PolicyConfig } from '../../../domain/system-core/entities/PolicyConfig';
import { IPolicyConfigRepository } from '../../../repository/interfaces/system-core/IPolicyConfigRepository';

/**
 * Task 267-C — wired-engine tests for the new typed policy resolution path.
 * The `PolicyEngine` now exposes `resolveTyped(...)` which loads a
 * `PolicyConfig` from the (optional) `IPolicyConfigRepository` and routes the
 * request through the `PolicyResolver`. The legacy `resolve(...)` facade is
 * preserved untouched, and the test below also pins that.
 */

class InMemoryPolicyConfigRepository implements IPolicyConfigRepository {
  private store: Map<string, PolicyConfig> = new Map();

  set(config: PolicyConfig): void {
    this.store.set(config.companyId, config);
  }

  async getConfig(companyId: string): Promise<PolicyConfig | null> {
    return this.store.get(companyId) ?? null;
  }

  async saveConfig(config: PolicyConfig): Promise<void> {
    config.updatedAt = new Date();
    this.store.set(config.companyId, config);
  }
}

describe('PolicyEngine.resolveTyped (Task 267-C)', () => {
  const posPolicyRepo = { getPolicy: jest.fn().mockResolvedValue(null) } as any;
  const companyId = 'cmp_typed';

  it('returns BLOCK with missingCompanyId when companyId is empty', async () => {
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, undefined);
    const result = await engine.resolveTyped({
      companyId: '',
      module: 'pos',
      action: 'directSale',
    });
    expect(result).toMatchObject({
      allowed: false,
      requiresApproval: false,
      decision: 'BLOCK',
      reasonCode: 'PolicyConfig.missingCompanyId',
    });
  });

  it('returns ALLOW (noMatchingRule) when the company has no config and no repo is wired', async () => {
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, undefined);
    const result = await engine.resolveTyped({
      companyId,
      module: 'pos',
      action: 'directSale',
    });
    expect(result).toMatchObject({
      allowed: true,
      requiresApproval: false,
      decision: 'ALLOW',
      reasonCode: 'PolicyConfig.noMatchingRule',
    });
  });

  it('consults the wired IPolicyConfigRepository and produces a fully populated result', async () => {
    const repo = new InMemoryPolicyConfigRepository();
    repo.set(new PolicyConfig({
      companyId,
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
    }));
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, repo);

    const below = await engine.resolveTyped({
      companyId,
      module: 'sales',
      action: 'invoicePosting',
      context: { amount: 5000 },
    });
    expect(below.allowed).toBe(true);

    const over = await engine.resolveTyped({
      companyId,
      module: 'sales',
      action: 'invoicePosting',
      context: { amount: 25000 },
    });
    expect(over).toMatchObject({
      allowed: false,
      requiresApproval: true,
      decision: 'REQUIRE_APPROVAL',
      reasonCode: 'SALES_INVOICE_OVER_THRESHOLD',
      effectiveRuleId: 'sales-invoice-threshold',
    });
  });

  it('hard rule wins over module override (cross-module scenario)', async () => {
    const repo = new InMemoryPolicyConfigRepository();
    repo.set(new PolicyConfig({
      companyId,
      rules: [
        {
          id: 'module-pos-allow',
          scope: 'MODULE',
          module: 'pos',
          action: 'directSale',
          effect: 'ALLOW',
        },
        {
          id: 'hard-period-lock',
          scope: 'TENANT',
          action: 'directSale',
          effect: 'BLOCK',
          isHard: true,
          reasonCode: 'PERIOD_LOCKED',
        },
      ],
    }));
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, repo);

    const result = await engine.resolveTyped({
      companyId,
      module: 'pos',
      action: 'directSale',
    });
    expect(result).toMatchObject({
      allowed: false,
      requiresApproval: false,
      decision: 'BLOCK',
      reasonCode: 'PERIOD_LOCKED',
      effectiveRuleId: 'hard-period-lock',
    });
  });

  it('POS terminal direct sale can allow without approval when module override is ALLOW', async () => {
    const repo = new InMemoryPolicyConfigRepository();
    repo.set(new PolicyConfig({
      companyId,
      rules: [
        {
          id: 'pos-direct-sale-allow',
          scope: 'MODULE',
          module: 'pos',
          action: 'directSale',
          effect: 'ALLOW',
        },
      ],
    }));
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, repo);

    const result = await engine.resolveTyped({
      companyId,
      module: 'pos',
      action: 'directSale',
      context: { registerId: 'reg-1' },
    });
    expect(result).toMatchObject({
      allowed: true,
      requiresApproval: false,
      decision: 'ALLOW',
    });
  });

  it('does not change the legacy resolve() facade (preserves existing behaviour)', async () => {
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, undefined);
    const result = await engine.resolve({
      scope: 'unknown',
      action: 'unknown',
      companyId,
      context: {},
    });
    expect(result).toEqual({
      allowed: true,
      requiresApproval: false,
      resolvedBy: ['PolicyEngine.defaultAllow'],
    });
  });

  it('FAILS CLOSED: a wired repository that throws must NOT allow the action', async () => {
    // Review feedback (267-C): a transient store failure (Firestore / SQL
    // down, timeout, etc.) must not silently grant access. The engine must
    // surface an explicit BLOCK with `PolicyConfig.repositoryError` so
    // callers / approval handoffs can detect degraded mode and audit it.
    const repo: IPolicyConfigRepository = {
      getConfig: jest.fn().mockRejectedValue(new Error('firestore offline')),
      saveConfig: jest.fn(),
    };
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, repo);
    const result = await engine.resolveTyped({
      companyId,
      module: 'pos',
      action: 'directSale',
    });
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(false);
    expect(result.decision).toBe('BLOCK');
    expect(result.reasonCode).toBe('PolicyConfig.repositoryError');
    expect(result.resolvedBy).toContain('PolicyConfig.repositoryError');
  });

  it('FAILS CLOSED: a wired repository returning null (no doc yet) defaults to ALLOW', async () => {
    // No doc yet for this company → no rules → default ALLOW. This is the
    // pre-267 unknown-scope fallback. The store is healthy; we are not
    // degrading.
    const repo: IPolicyConfigRepository = {
      getConfig: jest.fn().mockResolvedValue(null),
      saveConfig: jest.fn(),
    };
    const engine = new PolicyEngine(posPolicyRepo, undefined, undefined, repo);
    const result = await engine.resolveTyped({
      companyId,
      module: 'pos',
      action: 'directSale',
    });
    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBe('PolicyConfig.noMatchingRule');
  });
});
